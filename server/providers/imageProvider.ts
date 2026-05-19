import { ImageGenerationInput, ProviderTaskResult } from './types.js';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getImageApiBaseUrl() {
  return requireEnv('IMAGE_API_BASE_URL').replace(/\/$/, '');
}

function getImageSubmitPath() {
  return process.env.IMAGE_API_SUBMIT_PATH || '/v1/images/generations';
}

export async function submitImageGeneration(input: ImageGenerationInput): Promise<ProviderTaskResult> {
  const provider = input.provider || process.env.IMAGE_PROVIDER || 'external-image';
  const endpoint = `${getImageApiBaseUrl()}${getImageSubmitPath()}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireEnv('IMAGE_API_KEY')}`
    },
    body: JSON.stringify({
      prompt: input.prompt,
      reference_image_url: input.referenceImageUrl,
      reference_image_base64: input.referenceImageBase64,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
      metadata: input.metadata || {}
    })
  });

  const raw = await response.json().catch(async () => ({ text: await response.text() }));
  if (!response.ok) {
    throw new Error(`Image provider request failed (${response.status}): ${JSON.stringify(raw)}`);
  }

  const data = raw as any;
  return {
    provider,
    providerTaskId: data.task_id || data.id,
    status: data.status || (data.url || data.image_url ? 'succeeded' : 'submitted'),
    url: data.url || data.image_url || data.output?.url,
    raw
  };
}
