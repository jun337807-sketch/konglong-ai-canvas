import { Router } from 'express';
import { createTask, listTasksByProject, updateTask } from '../repositories/taskRepository.js';
import { resolveActorUserId } from '../repositories/userRepository.js';
import { writeAuditLog } from '../services/auditLogService.js';

const router = Router();

router.get('/workspace-projects/:projectId/tasks', (req, res) => {
  const tasks = listTasksByProject(req.params.projectId).map(task => ({
    ...task,
    input: JSON.parse(task.input_json || '{}'),
    output: task.output_json ? JSON.parse(task.output_json) : null
  }));
  res.json({ success: true, tasks });
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
