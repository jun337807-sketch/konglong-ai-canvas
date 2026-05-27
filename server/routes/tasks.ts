import { Router } from 'express';
import { queryImageGeneration } from '../providers/imageProvider.js';
import { ProviderTaskResult } from '../providers/types.js';
import { createTask, deleteTasksByProject, listTasksByProject, updateTask } from '../repositories/taskRepository.js';
import { resolveActorUserId } from '../repositories/userRepository.js';
import { writeAuditLog } from '../services/auditLogService.js';

const router = Router();
const reconcilingProjects = new Set<string>();

function safeParseJson(value: string | null | undefined, fallback: unknown) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toTaskStatus(result: ProviderTaskResult): 'running' | 'completed' | 'failed' {
  if (result.status === 'succeeded') return 'completed';
  if (result.status === 'failed') return 'failed';
  return 'running';
}

function looksLikeProviderTaskId(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text.startsWith('task_')) return false;
  // Grsai task ids commonly look like: 7-24f4cf5a-1dd4-4731-9d18-83f681b02f9b
  return /^\d+-[0-9a-f-]{12,}$/i.test(text)
    || /^[0-9a-f]{8}-[0-9a-f-]{12,}$/i.test(text);
}

function extractProviderTaskId(value: any, depth = 0): string | undefined {
  if (!value || depth > 8) return undefined;

  if (typeof value === 'string') {
    const text = value.trim();
    if (looksLikeProviderTaskId(text)) return text;
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try {
        return extractProviderTaskId(JSON.parse(text), depth + 1);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const id = extractProviderTaskId(item, depth + 1);
      if (id) return id;
    }
    return undefined;
  }

  if (typeof value !== 'object') return undefined;

  for (const key of ['providerTaskId', 'provider_task_id', 'taskId', 'task_id', 'id']) {
    const direct = value[key];
    if (looksLikeProviderTaskId(direct)) return String(direct).trim();
  }

  for (const key of ['raw', 'result', 'results', 'data', 'output', 'outputs', 'response']) {
    const id = extractProviderTaskId(value[key], depth + 1);
    if (id) return id;
  }

  for (const [key, item] of Object.entries(value)) {
    if (['prompt', 'input', 'inputs', 'payload', 'request'].includes(key)) continue;
    const id = extractProviderTaskId(item, depth + 1);
    if (id) return id;
  }

  return undefined;
}

async function reconcileRunningImageTask(task: any) {
  if (task.status !== 'running' || task.capability !== 'image.generate') return;
  const input = safeParseJson(task.input_json, {}) as any;
  const output = safeParseJson(task.output_json, null) as any;
  const providerTaskId = output?.providerTaskId || output?.raw?.id || extractProviderTaskId(output) || extractProviderTaskId(input);
  if (!providerTaskId) {
    console.warn('[tasks] image generation reconcile skipped: missing providerTaskId', {
      taskId: task.id,
      provider: task.provider,
      outputKeys: output && typeof output === 'object' ? Object.keys(output) : []
    });
    return;
  }

  try {
    const provider = looksLikeProviderTaskId(providerTaskId)
      ? 'grsai'
      : (output?.provider || output?.raw?.request?.provider || input?.provider || task.provider);
    const result = await queryImageGeneration({
      ...input,
      providerTaskId,
      provider
    });
    const nextStatus = toTaskStatus(result);
    if (nextStatus === 'running') return;
    updateTask(task.id, {
      status: nextStatus,
      output_json: JSON.stringify(result),
      error_message: result.errorMessage || null,
      completed_at: new Date().toISOString()
    });
    console.info('[tasks] reconciled image generation task', {
      taskId: task.id,
      providerTaskId,
      status: nextStatus
    });
  } catch (error: any) {
    console.warn('[tasks] image generation reconcile skipped', {
      taskId: task.id,
      providerTaskId,
      error: error?.message || error
    });
  }
}

async function reconcileRunningImageTasks(tasks: any[]) {
  const candidates = tasks
    .filter(task => task.status === 'running' && task.capability === 'image.generate')
    .slice(0, 8);
  for (const task of candidates) {
    await reconcileRunningImageTask(task);
  }
}

function scheduleImageTaskReconcile(projectId: string, tasks: any[]) {
  if (reconcilingProjects.has(projectId)) return;
  reconcilingProjects.add(projectId);
  setTimeout(() => {
    reconcileRunningImageTasks(tasks)
      .catch(error => {
        console.warn('[tasks] background image reconcile failed', {
          projectId,
          error: error?.message || error
        });
      })
      .finally(() => {
        reconcilingProjects.delete(projectId);
      });
  }, 0);
}

router.get('/workspace-projects/:projectId/tasks', async (req, res) => {
  try {
    const dbTasks = listTasksByProject(req.params.projectId);
    // 任务队列接口必须稳定、快速返回；服务商查询可能 502/超时，不能阻塞前端任务列表。
    scheduleImageTaskReconcile(req.params.projectId, dbTasks);
    const tasks = dbTasks.map(task => ({
      ...task,
      input: safeParseJson(task.input_json, {}),
      output: safeParseJson(task.output_json, null)
    }));
    res.json({ success: true, tasks });
  } catch (error: any) {
    console.error('[tasks] failed to list project tasks', {
      projectId: req.params.projectId,
      error: error?.message || error
    });
    res.status(500).json({
      success: false,
      error: 'task_list_failed',
      message: '任务列表读取失败',
      detail: error?.message || String(error)
    });
  }
});

router.post('/workspace-projects/:projectId/tasks', (req, res) => {
  const { createdBy, capability, provider, payload } = req.body || {};
  if (!createdBy || !capability || !provider) {
    return res.status(400).json({ success: false, error: 'missing required task fields' });
  }
  const actorUserId = resolveActorUserId(createdBy);
  const task = createTask({
    workspaceProjectId: req.params.projectId,
    createdBy: actorUserId,
    capability,
    provider,
    payload
  });
  writeAuditLog({
    workspaceProjectId: req.params.projectId,
    actorUserId,
    action: 'task.created',
    targetType: 'task',
    targetId: task.id,
    metadata: { capability, provider }
  });
  res.status(201).json({ success: true, task });
});

router.delete('/workspace-projects/:projectId/tasks', (req, res) => {
  const deletedCount = deleteTasksByProject(req.params.projectId);
  writeAuditLog({
    workspaceProjectId: req.params.projectId,
    actorUserId: resolveActorUserId(String(req.query.actor || 'system')),
    action: 'tasks.cleared',
    targetType: 'task',
    targetId: req.params.projectId,
    metadata: { deletedCount }
  });
  res.json({ success: true, deletedCount });
});

router.patch('/tasks/:id', (req, res) => {
  const { status, output, errorMessage, startedAt, completedAt } = req.body || {};
  const updated = updateTask(req.params.id, {
    status,
    output_json: output ? JSON.stringify(output) : undefined,
    error_message: errorMessage,
    started_at: startedAt,
    completed_at: completedAt
  });
  if (!updated) return res.status(404).json({ success: false, error: 'task not found' });
  writeAuditLog({
    workspaceProjectId: updated.workspace_project_id,
    actorUserId: updated.created_by,
    action: `task.${updated.status}`,
    targetType: 'task',
    targetId: updated.id,
    metadata: { status: updated.status }
  });
  res.json({ success: true, task: updated });
});

export default router;

