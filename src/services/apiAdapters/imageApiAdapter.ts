import { UnifiedTask } from '../../types/task';

/**
 * Adapter for calling the image generation API.
 * Maps UnifiedTask to specific image API payload format.
 */
export async function executeImageApi(task: UnifiedTask): Promise<string> {
  console.log(`[ImageApiAdapter] Executing ${task.capability} for task ${task.task_id}`);
  
  // NOTE: This is where you map `task.params` and `task.images` to the actual API request schema.
  // For migration to Express, this will be moved to the backend.

  const payload = {
    prompt: task.prompt,
    images: task.images, // Convert roles if necessary
    settings: {
      aspect_ratio: task.params.aspect_ratio || '16:9',
      style: task.params.style || 'auto',
      strength: task.params.strength
    }
  };

  console.log('[ImageApiAdapter] Formatted Payload:', payload);

  // MOCK: Replace inside node_backend with actual fetch
  return new Promise((resolve) => setTimeout(() => resolve('https://mock-image-url.com/result.png'), 2000));
}
