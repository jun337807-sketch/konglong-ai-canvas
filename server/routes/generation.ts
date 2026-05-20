import { Router } from 'express';
import { submitImageGeneration } from '../providers/imageProvider.js';
import { ProviderTaskResult } from '../providers/types.js';
import { queryVideoGeneration, submitVideoGeneration } from '../providers/videoProvider.js';
import { createAsset, DbAsset } from '../repositories/assetRepository.js';
import { createTask, findTaskById, updateTask } from '../repositories/taskRepository.js';
import { resolveActorUserId } from '../repositories/userRepository.js';
import { writeAuditLog } from '../services/auditLogService.js';
import { ingestExternalUrlToTos } from '../services/assetIngestService.js';

const router = Router();

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
  let assetUrl = input.result.url;
  let tosKey = input.result.url;
  let storage = 'external-provider';

  if (process.env.ASSET_INGEST_TO_TOS === 'true') {
    try {
      const ingested = await ingestExternalUrlToTos({
        sourceUrl: input.result.url,
        assetType: input.type,
        provider: input.result.provider,
        providerTaskId: input.result.providerTaskId
      });
      assetUrl = ingested.url;
      tosKey = ingested.key;
      storage = 'tos';
    } catch (err) {
      console.warn('Failed to ingest generated asset to TOS, keeping external URL:', err);
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
      originalUrl: input.result.url,
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

    void (async () => {
      try {
        const result = await submitImageGeneration(req.body);
        const updatedTask = updateGenerationTask({ taskId: task.id, result });
        await createAssetFromGeneration({ type: 'image', result, context, taskId: task.id });
        console.info('Async image generation completed:', { taskId: task.id, status: updatedTask?.status });
      } catch (err: any) {
        const updatedTask = updateGenerationTask({ taskId: task.id, errorMessage: err.message });
        console.error('Async image generation error:', { taskId: task.id, status: updatedTask?.status, error: err.message });
      }
    })();

    return res.status(202).json({
      success: true,
      result: {
        provider: provider || process.env.IMAGE_PROVIDER || 'external-image',
        providerTaskId: task.id,
        status: 'submitted'
      },
      task: findTaskById(task.id) || task
    });
  }

  try {
    const result = await submitImageGeneration(req.body);
    const updatedTask = updateGenerationTask({ taskId: task?.id, result });
    const asset = await createAssetFromGeneration({ type: 'image', result, context, taskId: task?.id });
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
    const updatedTask = updateGenerationTask({ taskId: task?.id, result });
    const asset = await createAssetFromGeneration({ type: 'video', result, context, taskId: task?.id });
    res.status(202).json({ success: true, result, task: updatedTask || task, asset });
  } catch (err: any) {
    const updatedTask = updateGenerationTask({ taskId: task?.id, errorMessage: err.message });
    console.error('Video generation submit error:', err);
    res.status(500).json({ success: false, error: err.message, task: updatedTask || task });
  }
});

router.get('/generation/video/:providerTaskId', async (req, res) => {
  try {
    const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
    const result = await queryVideoGeneration(req.params.providerTaskId, req.query.provider as string | undefined);
    const task = updateGenerationTask({ taskId, result });
    const asset = await createAssetFromGeneration({
      type: 'video',
      result,
      context: {
        workspaceProjectId: task?.workspace_project_id,
        actorUserId: task?.created_by,
        prompt: task?.input_json ? JSON.parse(task.input_json)?.prompt : undefined
      },
      taskId: task?.id
    });
    res.json({ success: true, result, task, asset });
  } catch (err: any) {
    const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
    const task = updateGenerationTask({ taskId, errorMessage: err.message });
    console.error('Video generation query error:', err);
    res.status(500).json({ success: false, error: err.message, task });
  }
});

export default router;
