import { generationRepository } from '../../repositories/generationRepository';
import { UnifiedTask } from '../../types/task';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Routes video generation through the backend provider adapter.
 * Keeps API keys on the server and returns Chinese failure messages from the backend.
 */
export async function executeVideoApi(task: UnifiedTask): Promise<string> {
  console.log(`[VideoApiAdapter] Executing ${task.capability} for task ${task.task_id}`);

  const imageUrls = task.images.map(image => image.url).filter(Boolean);
  const submit = await generationRepository.submitVideo({
    prompt: task.prompt,
    imageUrls,
    ratio: task.params.aspect_ratio || '16:9',
    duration: task.params.duration || 10,
    generateAudio: task.params.generate_audio ?? true,
    metadata: {
      source: 'CapabilityPanel',
      capability: task.capability,
      resolution: task.params.resolution || task.params.size || '720p',
      motionStrength: task.params.motion_strength,
      transitionStrength: task.params.transition_strength
    }
  });

  if (submit.result.status === 'failed') {
    throw new Error(submit.result.errorMessage || '视频生成失败');
  }

  if (submit.result.url) return submit.result.url;
  if (!submit.result.providerTaskId) throw new Error('视频生成失败：第三方服务没有返回任务 ID。');

  let transientErrorCount = 0;
  while (true) {
    await sleep(10000);
    try {
      const query = await generationRepository.queryVideo(submit.result.providerTaskId, {
        provider: submit.result.provider,
        taskId: submit.task?.id
      });
      transientErrorCount = 0;

      if (query.result.status === 'succeeded' && query.result.url) return query.result.url;
      if (query.result.status === 'failed') {
        throw new Error(query.result.errorMessage || '视频生成失败：第三方服务返回失败状态。');
      }
    } catch (error: any) {
      if (error?.message?.includes('第三方服务返回失败状态')) throw error;
      transientErrorCount += 1;
      console.warn('[VideoApiAdapter] queryVideo transient error, keep polling:', error);
      if (transientErrorCount >= 90) {
        throw new Error(`视频任务仍可能在服务商后台处理中，但连续查询失败：${error?.message || '网络异常'}`);
      }
    }
  }
}
