import { Task, taskQueueManager } from '../services/taskQueueManager';

function mapApiTask(task: any): Task {
  return {
    id: task.id,
    projectId: task.workspace_project_id,
    type: task.capability,
    status: task.status,
    payload: task.input || {},
    result: task.output || undefined,
    error: task.error_message || undefined,
    createdAt: task.created_at,
    updatedAt: task.updated_at
  } as Task;
}

export const taskRepository = {
  async listByProject(projectId: string) {
    try {
      const res = await fetch(`/api/workspace-projects/${projectId}/tasks`).then(r => r.json());
      if (res.success) return (res.tasks || []).map(mapApiTask);
    } catch (e) {
      console.warn('Failed to load tasks from API, falling back to local storage', e);
    }
    return taskQueueManager.getTasks(projectId);
  },

  async create(projectId: string, input: {
    createdBy?: string;
    capability: string;
    provider?: string;
    payload?: Record<string, unknown>;
  }) {
    try {
      const res = await fetch(`/api/workspace-projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createdBy: input.createdBy || 'system',
          capability: input.capability,
          provider: input.provider || 'local',
          payload: input.payload || {}
        })
      }).then(r => r.json());
      if (res.success && res.task) return mapApiTask({ ...res.task, input: input.payload || {} });
      throw new Error(res.error || 'Failed to create task');
    } catch (e) {
      console.warn('Failed to create task via API, falling back to local storage', e);
      return taskQueueManager.enqueueTask(projectId, input.capability as Task['type'], input.payload || {});
    }
  }
};
