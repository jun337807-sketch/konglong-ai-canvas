export type MediaCapability =
  | 'text_to_image'
  | 'image_to_image'
  | 'text_to_video'
  | 'image_to_video'
  | 'first_frame_video'
  | 'first_last_frame_video'
  | 'multi_reference_video';

export type ApiType = 'image_api' | 'video_api';
export type MediaType = 'image' | 'video';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TaskParams {
  aspect_ratio?: string;
  size?: string;
  style?: string;
  strength?: number;
  duration?: number;
  motion_strength?: number;
  transition_strength?: number;
  reference_roles?: string[];
  [key: string]: any;
}

export interface TaskImagePayload {
  url: string;
  role?: 'reference' | 'first_frame' | 'last_frame' | 'style' | 'character' | 'scene' | 'prop';
}

export interface UnifiedTask {
  task_id: string;             // Uniquely identifies the task
  capability: MediaCapability; // e.g., 'first_last_frame_video'
  api_type: ApiType;           // e.g., 'video_api'
  media_type: MediaType;       // e.g., 'video'
  prompt: string;              // The text prompt
  images: TaskImagePayload[];  // All uploaded images with their roles
  params: TaskParams;          // Additional generation parameters
  status: TaskStatus;          // Current status
  output_url?: string;         // Resulting URL if successful
  error_message?: string;      // Error message if failed
  created_at: number;          // Timestamp
}
