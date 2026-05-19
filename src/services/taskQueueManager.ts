export interface Task {
  id: string;
  projectId: string;
  type: 'image_generation' | 'video_generation' | 'audio_generation' | 'script_breakdown';
  status: 'pending' | 'running' | 'completed' | 'failed';
  nodeId?: string;
  payload: any;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY_PREFIX = 'canvas_tasks_';

class TaskQueueManager {
  async getTasks(projectId: string): Promise<Task[]> {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load tasks:', e);
    }
    return [];
  }

  async saveTasks(projectId: string, tasks: Task[]): Promise<boolean> {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, JSON.stringify(tasks));
      return true;
    } catch (e) {
      console.warn('Failed to save tasks:', e);
      return false;
    }
  }

  async enqueueTask(projectId: string, type: Task['type'], payload: any, nodeId?: string): Promise<Task> {
    const tasks = await this.getTasks(projectId);
    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      type,
      status: 'pending',
      payload,
      nodeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.saveTasks(projectId, [newTask, ...tasks]);
    return newTask;
  }

  async updateTaskStatus(projectId: string, taskId: string, status: Task['status'], result?: any, error?: string): Promise<void> {
    const tasks = await this.getTasks(projectId);
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status,
          result: result !== undefined ? result : t.result,
          error: error !== undefined ? error : t.error,
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    });
    await this.saveTasks(projectId, updated);
  }
}

export const taskQueueManager = new TaskQueueManager();
