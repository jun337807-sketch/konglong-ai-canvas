import { generationRepository, ProviderTaskResult } from '../repositories/generationRepository';

export interface DreaminaStatusResult {
  status: 'submitted' | 'processing' | 'success' | 'completed' | 'failed' | 'error';
  video_url: string | null;
  fail_reason: string | null;
  raw?: unknown;
}

let lastLocalTaskId: string | null = null;

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

export async function submitDreaminaVideo(prompt: string, imageUrl: string | null = null) {
  const { result, task } = await generationRepository.submitVideo({
    prompt,
    imageUrls: imageUrl ? [imageUrl] : [],
    ratio: '16:9',
    duration: 8,
    generateAudio: true,
    createdBy: localStorage.getItem('dino_currentUser') || 'system',
    metadata: {
      source: 'dreaminaApi.compat'
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
  onProgress: (status: string) => void
) {
  const taskId = await submitDreaminaVideo(prompt, imageUrl);
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
