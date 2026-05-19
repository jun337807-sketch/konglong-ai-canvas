import { UnifiedTask } from '../types/task';
import { executeImageApi } from './apiAdapters/imageApiAdapter';
import { executeVideoApi } from './apiAdapters/videoApiAdapter';
import { capabilityRegistry } from '../config/capabilityRegistry';

/**
 * Routes a UnifiedTask to the proper API adapter based on the capability registry.
 * This file is highly reusable across frontend (for mocks) and backend (for actual API calls).
 */
export async function executeTask(task: UnifiedTask): Promise<string> {
  const capabilityDef = capabilityRegistry[task.capability];
  
  if (!capabilityDef) {
    throw new Error(`Capability ${task.capability} not found in registry`);
  }

  // Safety check to ensure we match
  if (capabilityDef.apiType !== task.api_type) {
    console.warn(`Mismatch in API type. Found ${task.api_type}, expected ${capabilityDef.apiType}. Proceeding with expected.`);
  }

  switch (capabilityDef.apiType) {
    case 'image_api':
      return executeImageApi(task);
    case 'video_api':
      return executeVideoApi(task);
    default:
      throw new Error(`Unknown api_type: ${capabilityDef.apiType}`);
  }
}
