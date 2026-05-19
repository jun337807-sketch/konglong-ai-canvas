import { generationRepository } from '../../repositories/generationRepository';
import { UnifiedTask } from '../../types/task';

/**
 * Adapter for image generation.
 * Keeps the existing CapabilityPanel UI unchanged, but routes actual generation
 * through the backend provider adapter so API keys stay on the server.
 */
export async function executeImageApi(task: UnifiedTask): Promise<string> {
  console.log(`[ImageApiAdapter] Executing ${task.capability} for task ${task.task_id}`);

  const referenceImages = task.images.map(image => image.url).filter(Boolean);
  const firstReferenceImage = referenceImages[0];
  const isBase64Reference = typeof firstReferenceImage === 'string' && firstReferenceImage.startsWith('data:image/');

  const { result } = await generationRepository.submitImage({
    prompt: task.prompt,
    aspectRatio: task.params.aspect_ratio || '16:9',
    resolution: task.params.size || '1K',
    uiModel: task.params.ui_model,
    referenceImages,
    referenceImageBase64: isBase64Reference ? firstReferenceImage : undefined,
    referenceImageUrl: !isBase64Reference ? firstReferenceImage : undefined,
    metadata: {
      source: 'CapabilityPanel',
      capability: task.capability,
      imageCount: task.params.image_count,
      style: task.params.style,
      strength: task.params.strength
    }
  });

  if (result.status === 'failed') {
    throw new Error(result.errorMessage || '图片生成失败');
  }

  if (!result.url) {
    throw new Error('图片生成接口没有返回图片 URL');
  }

  return result.url;
}
