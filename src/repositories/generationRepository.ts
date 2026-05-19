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
