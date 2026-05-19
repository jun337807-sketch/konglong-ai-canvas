export type ProviderKind = 'image' | 'video';

export interface ProviderTaskResult {
  provider: string;
  providerTaskId?: string;
  status: 'submitted' | 'processing' | 'succeeded' | 'failed';
  url?: string;
  errorMessage?: string;
  raw?: unknown;
}

export interface ImageGenerationInput {
  prompt: string;
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

export interface VideoGenerationInput {
  prompt: string;
  provider?: string;
  imageUrls?: string[];
  ratio?: string;
  duration?: number;
  generateAudio?: boolean;
  metadata?: Record<string, unknown>;
}
