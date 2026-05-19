import { UnifiedTask } from '../../types/task';

/**
 * Adapter for calling the video generation API.
 * Maps UnifiedTask to specific video API payload format.
 */
export async function executeVideoApi(task: UnifiedTask): Promise<string> {
  console.log(`[VideoApiAdapter] Executing ${task.capability} for task ${task.task_id}`);
  
  // NOTE: This is where you map `task.params` and `task.images` to the actual API request schema.
  // For migration to Express, this will be moved to the backend.

  const payload = {
    prompt: task.prompt,
    images: task.images, // Map reference roles intelligently
    settings: {
      aspect_ratio: task.params.aspect_ratio || '16:9',
      duration: task.params.duration || 5,
      motion: task.params.motion_strength || 5,
      transition: task.params.transition_strength
    }
  };

  console.log('[VideoApiAdapter] Formatted Payload:', payload);

  // MOCK: Replace inside node_backend with actual fetch
  return new Promise((resolve) => setTimeout(() => resolve('https://mock-video-url.com/result.mp4'), 2000));
}
