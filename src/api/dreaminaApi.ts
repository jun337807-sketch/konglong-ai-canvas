import { generationRepository, ProviderTaskResult } from '../repositories/generationRepository';

export interface DreaminaStatusResult {
  status: 'submitted' | 'processing' | 'success' | 'completed' | 'failed' | 'error';
  video_url: string | null;
  fail_reason: string | null;
  raw?: unknown;
}

let lastLocalTaskId: string | null = null;

export interface DreaminaVideoOptions {
  imageUrls?: string[];
  ratio?: string;
  duration?: number;
  resolution?: string;
  generateAudio?: boolean;
  model?: string;
  metadata?: Record<string, unknown>;
}

function normalizeRatio(ratio?: string) {
  if (!ratio || ratio === 'Auto') return '16:9';
  return ratio;
}

function normalizeResolution(resolution?: string) {
  const value = (resolution || '720p').toLowerCase();
  return value === '480p' ? '480p' : '720p';
}

function normalizeDuration(duration?: number) {
  const value = Number(duration || 10);
  if (!Number.isFinite(value)) return 10;
  return Math.max(4, Math.min(15, Math.round(value)));
}

function normalizeStatus(result: ProviderTaskResult): DreaminaStatusResult {
  if (result.status === 'succeeded') {
    return {
      status: 'success',
      video_url: result.url || null,
      fail_reason: null,
      raw: result.raw
    };
  }

  if (result.status === 'failed') {
    return {
      status: 'failed',
      video_url: null,
      fail_reason: result.errorMessage || '视频生成失败',
      raw: result.raw
    };
  }

  return {
    status: result.status === 'submitted' ? 'submitted' : 'processing',
    video_url: result.url || null,
    fail_reason: null,
    raw: result.raw
  };
}

export async function submitDreaminaVideo(
  prompt: string,
  imageUrl: string | null = null,
  options: DreaminaVideoOptions = {}
) {
  const imageUrls = options.imageUrls ?? (imageUrl ? [imageUrl] : []);
  const { result, task } = await generationRepository.submitVideo({
    prompt,
    imageUrls,
    ratio: normalizeRatio(options.ratio),
    duration: normalizeDuration(options.duration),
    generateAudio: options.generateAudio ?? true,
    createdBy: localStorage.getItem('dino_currentUser') || 'system',
    metadata: {
      source: 'dreaminaApi.compat',
      resolution: normalizeResolution(options.resolution),
      videoModel: options.model,
      referenceCount: imageUrls.length,
      ...options.metadata
    }
  });

  lastLocalTaskId = task?.id || null;

  if (result.status === 'succeeded' && result.url) {
    return `completed:${encodeURIComponent(result.url)}`;
  }

  if (result.status === 'failed') {
    throw new Error(result.errorMessage || '视频生成提交失败');
  }

  if (!result.providerTaskId) {
    throw new Error('视频供应商没有返回任务 ID');
  }

  return result.providerTaskId;
}

export async function queryDreaminaStatus(taskId: string): Promise<DreaminaStatusResult> {
  if (taskId.startsWith('completed:')) {
    return {
      status: 'success',
      video_url: decodeURIComponent(taskId.replace('completed:', '')),
      fail_reason: null
    };
  }

  const { result, task } = await generationRepository.queryVideo(taskId, {
    taskId: lastLocalTaskId || undefined
  });
  if (task?.id) lastLocalTaskId = task.id;
  return normalizeStatus(result);
}

export async function generateDreaminaVideoAndWait(
  prompt: string,
  imageUrl: string | null,
  onProgress: (status: string) => void,
  options: DreaminaVideoOptions = {}
) {
  const taskId = await submitDreaminaVideo(prompt, imageUrl, options);
  onProgress?.('submitted');

  while (true) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const res = await queryDreaminaStatus(taskId);

    if (res.status === 'success' || res.status === 'completed') {
      if (!res.video_url) throw new Error('视频生成完成，但没有返回视频链接');
      return res.video_url;
    }

    if (res.status === 'failed' || res.status === 'error') {
      throw new Error(res.fail_reason || '视频生成失败');
    }

    onProgress?.('processing');
  }
}
