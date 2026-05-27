import { Router } from 'express';
import { queryImageGeneration, submitImageGeneration } from '../providers/imageProvider.js';
import { ProviderTaskResult } from '../providers/types.js';
import { queryVideoGeneration, submitVideoGeneration } from '../providers/videoProvider.js';
import { createAsset, DbAsset } from '../repositories/assetRepository.js';
import { createTask, findTaskById, updateTask } from '../repositories/taskRepository.js';
import { resolveActorUserId } from '../repositories/userRepository.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { ingestExternalUrlToTos } from '../services/assetIngestService.js';

const router = Router();
const activeImageFollowups = new Set<string>();

type GenerationCapability = 'image.generate' | 'video.generate';

type GenerationContext = {
  workspaceProjectId?: string;
  actorUserId?: string;
  prompt?: string;
};

function toTaskStatus(result: ProviderTaskResult): 'running' | 'completed' | 'failed' {
  if (result.status === 'succeeded') return 'completed';
  if (result.status === 'failed') return 'failed';
  return 'running';
}

function maybeCreateGenerationTask(input: {
  workspaceProjectId?: string;
  createdBy?: string;
  capability: GenerationCapability;
  provider: string;
  payload: Record<string, unknown>;
}) {
  if (!input.workspaceProjectId) return undefined;

  const actorUserId = resolveActorUserId(input.createdBy || 'system');
  const task = createTask({
    workspaceProjectId: input.workspaceProjectId,
    createdBy: actorUserId,
    capability: input.capability,
    provider: input.provider,
    payload: input.payload
  });

  writeAuditLog({
    workspaceProjectId: input.workspaceProjectId,
    actorUserId,
    action: `${input.capability}.submitted`,
    targetType: 'task',
    targetId: task.id,
    metadata: { provider: input.provider }
  });

  return task;
}

function updateGenerationTask(input: {
  taskId?: string;
  result?: ProviderTaskResult;
  errorMessage?: string;
}) {
  if (!input.taskId) return undefined;

  const now = new Date().toISOString();
  const task = findTaskById(input.taskId);
  if (!task) return undefined;

  const updated = updateTask(input.taskId, {
    status: input.errorMessage ? 'failed' : input.result ? toTaskStatus(input.result) : 'running',
    output_json: input.result ? JSON.stringify(input.result) : task.output_json,
    error_message: input.errorMessage || input.result?.errorMessage || null,
    started_at: task.started_at || now,
    completed_at: input.errorMessage || input.result?.status === 'succeeded' || input.result?.status === 'failed' ? now : null
  });

  if (updated) {
    writeAuditLog({
      workspaceProjectId: updated.workspace_project_id,
      actorUserId: updated.created_by,
      action: `task.${updated.status}`,
      targetType: 'task',
      targetId: updated.id,
      metadata: (input.result ? { ...input.result } : { errorMessage: input.errorMessage })
    });
  }

  return updated;
}

function scheduleImageGenerationFollowup(input: {
  taskId?: string;
  result?: ProviderTaskResult;
  context: GenerationContext;
}) {
  const { taskId, result, context } = input;
  const providerTaskId = result?.providerTaskId;
  if (!taskId || !providerTaskId || result?.status === 'succeeded' || result?.status === 'failed') return;
  if (activeImageFollowups.has(taskId)) return;

  activeImageFollowups.add(taskId);
  const provider = result.provider;
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.IMAGE_PROVIDER_FOLLOWUP_TIMEOUT_MS || 1800000);
  const intervalMs = Number(process.env.IMAGE_PROVIDER_FOLLOWUP_INTERVAL_MS || 10000);

  const tick = async () => {
    try {
      const existingTask = findTaskById(taskId);
      if (!existingTask || existingTask.status === 'completed' || existingTask.status === 'failed' || existingTask.status === 'canceled') {
        activeImageFollowups.delete(taskId);
        return;
      }

      const payload = existingTask.input_json ? JSON.parse(existingTask.input_json) : {};
      const nextResult = await queryImageGeneration({
        ...payload,
        provider,
        providerTaskId
      });

      if (nextResult.status === 'succeeded' || nextResult.status === 'failed') {
        const asset = await createAssetFromGeneration({
          type: 'image',
          result: nextResult,
          context: {
            workspaceProjectId: existingTask.workspace_project_id,
            actorUserId: existingTask.created_by,
            prompt: payload?.prompt || context.prompt
          },
          taskId
        });
        updateGenerationTask({ taskId, result: nextResult });
        console.info('[generation] image provider followup finished', {
          taskId,
          providerTaskId,
          status: nextResult.status,
          hasUrl: Boolean(nextResult.url),
          assetId: asset?.id
        });
        activeImageFollowups.delete(taskId);
        return;
      }
    } catch (error: any) {
      console.warn('[generation] image provider followup waiting', {
        taskId,
        providerTaskId,
        error: error?.message || error
      });
    }

    if (Date.now() - startedAt >= timeoutMs) {
      console.warn('[generation] image provider followup timeout, keep task running for manual recovery', {
        taskId,
        providerTaskId,
        timeoutMs
      });
      activeImageFollowups.delete(taskId);
      return;
    }

    setTimeout(tick, intervalMs);
  };

  setTimeout(tick, Math.min(3000, intervalMs));
}

async function createAssetFromGeneration(input: {
  type: DbAsset['type'];
  result: ProviderTaskResult;
  context: GenerationContext;
  taskId?: string;
}): Promise<DbAsset | undefined> {
  const { workspaceProjectId, actorUserId, prompt } = input.context;
  if (!workspaceProjectId || !actorUserId || input.result.status !== 'succeeded' || !input.result.url) {
    return undefined;
  }

  const nowLabel = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const originalUrl = input.result.url;
  let assetUrl = originalUrl;
  let tosKey = originalUrl;
  let storage = 'external-provider';
  const ingestToTos = process.env.ASSET_INGEST_TO_TOS === 'true';
  const requireTos = process.env.ASSET_REQUIRE_TOS === 'true';

  if (requireTos && !ingestToTos) {
    throw new Error('生成成功，但服务器未开启 TOS 持久化，已拒绝保存临时链接。请开启 ASSET_INGEST_TO_TOS=true。');
  }

  if (ingestToTos) {
    try {
      const ingested = await ingestExternalUrlToTos({
        sourceUrl: originalUrl,
        assetType: input.type,
        provider: input.result.provider,
        providerTaskId: input.result.providerTaskId
      });
      assetUrl = ingested.url;
      tosKey = ingested.key;
      storage = 'tos';
      input.result.url = assetUrl;
      input.result.raw = {
        ...(typeof input.result.raw === 'object' && input.result.raw ? input.result.raw : {}),
        originalUrl,
        persistedUrl: assetUrl,
        storage: 'tos'
      };
    } catch (err) {
      console.error('Failed to ingest generated asset to TOS:', err);
      if (requireTos) {
        throw new Error(
          `生成成功，但转存到 TOS 失败，已拒绝保存临时链接。请检查 TOS 配置或第三方结果 URL 是否可下载。原因：${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  const asset = createAsset({
    workspaceProjectId,
    type: input.type,
    name: `${input.type === 'image' ? '生成图片' : '生成视频'} ${nowLabel}`,
    tosKey,
    url: assetUrl,
    createdBy: actorUserId,
    metadata: {
      storage,
      originalUrl,
      provider: input.result.provider,
      providerTaskId: input.result.providerTaskId,
      taskId: input.taskId,
      prompt
    }
  });

  writeAuditLog({
    workspaceProjectId,
    actorUserId,
    action: 'asset.created.from_generation',
    targetType: 'asset',
    targetId: asset.id,
    metadata: {
      type: input.type,
      provider: input.result.provider,
      taskId: input.taskId
    }
  });

  return asset;
}

function buildGenerationContext(body: any): GenerationContext {
  return {
    workspaceProjectId: body?.workspaceProjectId,
    actorUserId: body?.workspaceProjectId ? resolveActorUserId(body?.createdBy || 'system') : undefined,
    prompt: body?.prompt
  };
}

router.post('/generation/image', async (req, res) => {
  const { prompt, workspaceProjectId, createdBy, provider } = req.body || {};
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });

  const context = buildGenerationContext(req.body);
  const task = maybeCreateGenerationTask({
    workspaceProjectId,
    createdBy,
    capability: 'image.generate',
    provider: provider || process.env.IMAGE_PROVIDER || 'external-image',
    payload: req.body || {}
  });

  if (task) {
    updateGenerationTask({ taskId: task.id });

    try {
      const result = await submitImageGeneration(req.body);
      const asset = await createAssetFromGeneration({ type: 'image', result, context, taskId: task.id });
      const updatedTask = updateGenerationTask({ taskId: task.id, result });
      scheduleImageGenerationFollowup({ taskId: task.id, result, context });
      return res.status(202).json({ success: true, result, task: updatedTask || task, asset });
    } catch (err: any) {
      const updatedTask = updateGenerationTask({ taskId: task.id, errorMessage: err.message });
      console.error('Image generation submit error:', { taskId: task.id, status: updatedTask?.status, error: err.message });
      return res.status(500).json({ success: false, error: err.message, task: updatedTask || task });
    }
  }

  try {
    const result = await submitImageGeneration(req.body);
    const asset = await createAssetFromGeneration({ type: 'image', result, context, taskId: task?.id });
    const updatedTask = updateGenerationTask({ taskId: task?.id, result });
    scheduleImageGenerationFollowup({ taskId: task?.id, result, context });
    res.status(202).json({ success: true, result, task: updatedTask || task, asset });
  } catch (err: any) {
    const updatedTask = updateGenerationTask({ taskId: task?.id, errorMessage: err.message });
    console.error('Image generation submit error:', err);
    res.status(500).json({ success: false, error: err.message, task: updatedTask || task });
  }
});

router.post('/generation/video', async (req, res) => {
  const { prompt, workspaceProjectId, createdBy, provider } = req.body || {};
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });

  const context = buildGenerationContext(req.body);
  const task = maybeCreateGenerationTask({
    workspaceProjectId,
    createdBy,
    capability: 'video.generate',
    provider: provider || process.env.VIDEO_PROVIDER || 'volcengine-seedance',
    payload: req.body || {}
  });

  try {
    const result = await submitVideoGeneration(req.body);
    const asset = await createAssetFromGeneration({ type: 'video', result, context, taskId: task?.id });
    const updatedTask = updateGenerationTask({ taskId: task?.id, result });
    res.status(202).json({ success: true, result, task: updatedTask || task, asset });
  } catch (err: any) {
    const updatedTask = updateGenerationTask({ taskId: task?.id, errorMessage: err.message });
    console.error('Video generation submit error:', err);
    res.status(500).json({ success: false, error: err.message, task: updatedTask || task });
  }
});

router.get('/generation/image/:providerTaskId', async (req, res) => {
  const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
  const existingTask = taskId ? findTaskById(taskId) : undefined;

  try {
    const payload = existingTask?.input_json ? JSON.parse(existingTask.input_json) : {};
    const provider =
      typeof req.query.provider === 'string'
        ? req.query.provider
        : (existingTask?.output_json ? JSON.parse(existingTask.output_json)?.provider : undefined) ||
          payload?.provider ||
          existingTask?.provider ||
          process.env.IMAGE_PROVIDER ||
          'grsai';

    const result = await queryImageGeneration({
      ...payload,
      provider,
      providerTaskId: req.params.providerTaskId
    });

    const asset = await createAssetFromGeneration({
      type: 'image',
      result,
      context: {
        workspaceProjectId: existingTask?.workspace_project_id,
        actorUserId: existingTask?.created_by,
        prompt: payload?.prompt
      },
      taskId: existingTask?.id
    });
    const task = updateGenerationTask({ taskId, result });

    return res.json({ success: true, result, task, asset });
  } catch (err: any) {
    const message = err?.message || '图片任务查询失败';
    const isTransient = /fetch failed|Bad Gateway|502|503|504|ETIMEDOUT|ECONNRESET|network|Unexpected token|非 JSON/i.test(message);

    if (isTransient) {
      const output = existingTask?.output_json ? JSON.parse(existingTask.output_json) : undefined;
      console.warn('Image generation query transient error, keep task running:', {
        taskId,
        providerTaskId: req.params.providerTaskId,
        error: message
      });
      return res.json({
        success: true,
        result: {
          provider: output?.provider || req.query.provider || process.env.IMAGE_PROVIDER || 'grsai',
          providerTaskId: req.params.providerTaskId,
          status: 'processing',
          raw: { transientError: message }
        },
        task: existingTask
      });
    }

    const task = updateGenerationTask({ taskId, errorMessage: message });
    console.error('Image generation query error:', { taskId, providerTaskId: req.params.providerTaskId, error: message });
    return res.status(500).json({ success: false, error: message, task });
  }
});

router.get('/generation/video/:providerTaskId', async (req, res) => {
  try {
    const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
    const result = await queryVideoGeneration(req.params.providerTaskId, req.query.provider as string | undefined);
    const existingTask = taskId ? findTaskById(taskId) : undefined;
    const asset = await createAssetFromGeneration({
      type: 'video',
      result,
      context: {
        workspaceProjectId: existingTask?.workspace_project_id,
        actorUserId: existingTask?.created_by,
        prompt: existingTask?.input_json ? JSON.parse(existingTask.input_json)?.prompt : undefined
      },
      taskId: existingTask?.id
    });
    const task = updateGenerationTask({ taskId, result });
    res.json({ success: true, result, task, asset });
  } catch (err: any) {
    const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
    const message = err?.message || '视频任务查询失败';
    const isTransient = /fetch failed|Bad Gateway|502|503|504|ETIMEDOUT|ECONNRESET|network/i.test(message);

    if (isTransient) {
      const task = taskId ? findTaskById(taskId) : undefined;
      console.warn('Video generation query transient error, keep task running:', err);
      return res.json({
        success: true,
        result: {
          provider: req.query.provider || process.env.VIDEO_PROVIDER || 'mjapi-monthly',
          providerTaskId: req.params.providerTaskId,
          status: 'processing',
          errorMessage: null,
          raw: { transientError: message }
        },
        task
      });
    }

    const task = updateGenerationTask({ taskId, errorMessage: message });
    console.error('Video generation query error:', err);
    res.status(500).json({ success: false, error: message, task });
  }
});

export default router;

