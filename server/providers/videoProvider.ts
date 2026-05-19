import { ProviderTaskResult, VideoGenerationInput } from './types.js';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getVideoApiBaseUrl() {
  return (process.env.VIDEO_API_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
}

function normalizeVideoResult(raw: any, provider: string): ProviderTaskResult {
  const statusMap: Record<string, ProviderTaskResult['status']> = {
    queued: 'processing',
    pending: 'processing',
    running: 'processing',
    processing: 'processing',
    succeeded: 'succeeded',
    success: 'succeeded',
    completed: 'succeeded',
    failed: 'failed',
    error: 'failed'
  };

  const rawStatus = raw?.status || raw?.state || 'submitted';
  const status = statusMap[String(rawStatus).toLowerCase()] || 'submitted';
  const videoUrl = raw?.content?.video_url?.url || raw?.content?.video_url || raw?.video_url || raw?.output?.video_url || raw?.url;

  return {
    provider,
    providerTaskId: raw?.id || raw?.task_id,
    status,
    url: typeof videoUrl === 'string' ? videoUrl : videoUrl?.url,
    errorMessage: raw?.error?.message || raw?.fail_reason,
    raw
  };
}

export async function submitVideoGeneration(input: VideoGenerationInput): Promise<ProviderTaskResult> {
  const provider = input.provider || process.env.VIDEO_PROVIDER || 'volcengine-seedance';
  const endpoint = `${getVideoApiBaseUrl()}/content_generation/tasks`;
  const content = [{ type: 'text', text: input.prompt }];

  for (const imageUrl of input.imageUrls || []) {
    if (imageUrl) {
      content.push({ type: 'image_url', image_url: { url: imageUrl }, role: 'reference_image' } as any);
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireEnv('VIDEO_API_KEY')}`
    },
    body: JSON.stringify({
      model: process.env.VIDEO_MODEL || 'doubao-seedance-2-0-260128',
      content,
      generate_audio: input.generateAudio ?? true,
      ratio: input.ratio || '16:9',
      duration: input.duration || 8,
      watermark: process.env.VIDEO_WATERMARK !== 'false',
      metadata: input.metadata || {}
    })
  });

  const raw = await response.json().catch(async () => ({ text: await response.text() }));
  if (!response.ok) {
    throw new Error(`Video provider request failed (${response.status}): ${JSON.stringify(raw)}`);
  }

  return normalizeVideoResult(raw, provider);
}

export async function queryVideoGeneration(providerTaskId: string, provider = process.env.VIDEO_PROVIDER || 'volcengine-seedance'): Promise<ProviderTaskResult> {
  const endpoint = `${getVideoApiBaseUrl()}/content_generation/tasks/${encodeURIComponent(providerTaskId)}`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${requireEnv('VIDEO_API_KEY')}`
    }
  });

  const raw = await response.json().catch(async () => ({ text: await response.text() }));
  if (!response.ok) {
    throw new Error(`Video provider query failed (${response.status}): ${JSON.stringify(raw)}`);
  }

  return normalizeVideoResult(raw, provider);
}
