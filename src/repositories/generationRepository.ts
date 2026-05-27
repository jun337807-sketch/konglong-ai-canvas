export type GenerationStatus = 'submitted' | 'processing' | 'succeeded' | 'failed';

export interface ProviderTaskResult {
  provider: string;
  providerTaskId?: string;
  status: GenerationStatus;
  url?: string;
  errorMessage?: string;
  raw?: unknown;
}

export interface GenerationTaskSnapshot {
  id: string;
  workspaceProjectId: string;
  createdBy: string;
  capability: string;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  input?: Record<string, unknown>;
  output?: ProviderTaskResult | Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationResponse {
  result: ProviderTaskResult;
  task?: GenerationTaskSnapshot;
}

export interface ImageGenerationRequest {
  prompt: string;
  workspaceProjectId?: string;
  createdBy?: string;
  provider?: string;
  model?: string;
  uiModel?: string;
  referenceImageUrl?: string;
  referenceImageBase64?: string;
  referenceImages?: string[];
  aspectRatio?: string;
  resolution?: string;
  metadata?: Record<string, unknown>;
}

export interface VideoGenerationRequest {
  prompt: string;
  workspaceProjectId?: string;
  createdBy?: string;
  provider?: string;
  imageUrls?: string[];
  referenceRoles?: string[];
  cleanOutputConstraints?: boolean;
  ratio?: string;
  duration?: number;
  generateAudio?: boolean;
  metadata?: Record<string, unknown>;
}

function mapTask(task: any): GenerationTaskSnapshot | undefined {
  if (!task) return undefined;
  return {
    id: task.id,
    workspaceProjectId: task.workspace_project_id,
    createdBy: task.created_by,
    capability: task.capability,
    provider: task.provider,
    status: task.status,
    input: task.input || safeJsonParse(task.input_json),
    output: task.output || safeJsonParse(task.output_json),
    errorMessage: task.error_message,
    createdAt: task.created_at,
    updatedAt: task.updated_at
  };
}

function safeJsonParse(value?: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function findProviderTaskId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const direct =
    record.providerTaskId ||
    record.id ||
    record.taskId ||
    (record.result && typeof record.result === 'object' ? (record.result as Record<string, unknown>).id : undefined);
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  for (const nested of Object.values(record)) {
    if (!nested || typeof nested !== 'object') continue;
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const found = findProviderTaskId(item);
        if (found) return found;
      }
    } else {
      const found = findProviderTaskId(nested);
      if (found) return found;
    }
  }
  return undefined;
}

function readProvider(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const provider = (value as Record<string, unknown>).provider;
  return typeof provider === 'string' && provider.trim() ? provider.trim() : undefined;
}

async function requestGeneration<TBody extends Record<string, unknown>>(url: string, body: TBody): Promise<GenerationResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Generation request failed: ${res.status}`);
  }
  return {
    result: data.result,
    task: mapTask(data.task)
  };
}

export const generationRepository = {
  submitImage(input: ImageGenerationRequest): Promise<GenerationResponse> {
    return requestGeneration('/api/generation/image', input as unknown as Record<string, unknown>);
  },

  async listTasks(projectId: string): Promise<GenerationTaskSnapshot[]> {
    const res = await fetch(`/api/workspace-projects/${encodeURIComponent(projectId)}/tasks`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Generation task list failed: ${res.status}`);
    }
    return (data.tasks || []).map(mapTask).filter(Boolean) as GenerationTaskSnapshot[];
  },

  async queryImage(providerTaskId: string, options?: { provider?: string; taskId?: string }): Promise<GenerationResponse> {
    const params = new URLSearchParams();
    if (options?.provider) params.set('provider', options.provider);
    if (options?.taskId) params.set('taskId', options.taskId);

    const query = params.toString();
    const res = await fetch(`/api/generation/image/${encodeURIComponent(providerTaskId)}${query ? `?${query}` : ''}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Image generation query failed: ${res.status}`);
    }
    return {
      result: data.result,
      task: mapTask(data.task)
    };
  },

  async waitForTask(projectId: string, taskId: string, options?: { timeoutMs?: number; intervalMs?: number }): Promise<GenerationTaskSnapshot> {
    const timeoutMs = options?.timeoutMs || 900000;
    const intervalMs = options?.intervalMs || 3000;
    const startedAt = Date.now();
    let lastReadError: Error | null = null;

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const tasks = await this.listTasks(projectId);
        const task = tasks.find(item => item.id === taskId);
        lastReadError = null;
        if (task?.status === 'completed' || task?.status === 'failed' || task?.status === 'canceled') {
          return task;
        }
        if (task?.status === 'running') {
          const providerTaskId = findProviderTaskId(task.output) || findProviderTaskId(task.input);
          if (providerTaskId) {
            try {
              const queried = await this.queryImage(providerTaskId, {
                taskId: task.id,
                provider: readProvider(task.output) || readProvider(task.input) || task.provider
              });
              if (queried.task?.status === 'completed' || queried.task?.status === 'failed' || queried.task?.status === 'canceled') {
                return queried.task;
              }
            } catch (queryError: any) {
              // 查询服务商结果偶发 502/HTML 时继续轮询；不能把后台已提交任务提前判失败。
              lastReadError = queryError instanceof Error ? queryError : new Error(String(queryError));
            }
          }
        }
      } catch (error: any) {
        // 生成任务在服务端后台继续跑；任务列表偶发 502/非 JSON 时不能让前端提前结束 loading。
        lastReadError = error instanceof Error ? error : new Error(String(error));
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    if (lastReadError) {
      throw new Error(`图片仍在生成，但任务列表读取不稳定：${lastReadError.message}`);
    }
    throw new Error(`图片生成仍在服务商后台处理中，已等待 ${Math.round(timeoutMs / 1000)} 秒。请稍后查看任务队列。`);
  },

  submitVideo(input: VideoGenerationRequest): Promise<GenerationResponse> {
    return requestGeneration('/api/generation/video', input as unknown as Record<string, unknown>);
  },

  async queryVideo(providerTaskId: string, options?: { provider?: string; taskId?: string }): Promise<GenerationResponse> {
    const params = new URLSearchParams();
    if (options?.provider) params.set('provider', options.provider);
    if (options?.taskId) params.set('taskId', options.taskId);

    const query = params.toString();
    const res = await fetch(`/api/generation/video/${encodeURIComponent(providerTaskId)}${query ? `?${query}` : ''}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Generation query failed: ${res.status}`);
    }
    return {
      result: data.result,
      task: mapTask(data.task)
    };
  }
};
