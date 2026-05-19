import { ImageGenerationInput, ProviderTaskResult } from './types.js';

type ImageSize = {
  width: number;
  height: number;
  size: string;
};

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

function getImageEditPath() {
  return process.env.IMAGE_API_EDIT_PATH || '/v1/images/edits';
}

function normalizeUiModel(value?: string) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveImageModel(input: ImageGenerationInput) {
  if (input.model) return input.model;

  const uiModel = normalizeUiModel(input.uiModel || String(input.metadata?.uiModel || ''));

  if (uiModel.includes('banana pro')) {
    return process.env.IMAGE_MODEL_KONGLONG_BANANA_PRO || 'gemini-3-pro-image-preview';
  }

  if (uiModel.includes('banana 2') || uiModel.includes('banan 2')) {
    return process.env.IMAGE_MODEL_KONGLONG_BANANA_2 || 'gemini-3.1-flash-image-preview-4k';
  }

  if (uiModel.includes('konglong image')) {
    return process.env.IMAGE_MODEL_KONGLONG_IMAGE || process.env.IMAGE_MODEL || 'gpt-image-2-fast';
  }

  return process.env.IMAGE_MODEL || process.env.IMAGE_MODEL_KONGLONG_IMAGE || 'gpt-image-2-fast';
}

function resolveImageSize(aspectRatio = '1:1', resolution = '1K'): ImageSize {
  const maxDimByResolution: Record<string, number> = {
    '1K': 1024,
    '2K': 2048,
    '4K': 4096,
    '720P': 1280,
    '1080P': 1920
  };

  const normalizedResolution = resolution.toUpperCase();
  const maxDim = maxDimByResolution[normalizedResolution] || 1024;
  const normalizedRatio = aspectRatio === '自适应' || aspectRatio === 'Auto' ? '1:1' : aspectRatio;
  const [xRaw, yRaw] = normalizedRatio.split(':');
  const x = Number.parseInt(xRaw, 10);
  const y = Number.parseInt(yRaw, 10);

  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) {
    return { width: maxDim, height: maxDim, size: `${maxDim}x${maxDim}` };
  }

  if (x >= y) {
    const width = maxDim;
    const height = Math.max(64, Math.round((y / x) * maxDim));
    return { width, height, size: `${width}x${height}` };
  }

  const height = maxDim;
  const width = Math.max(64, Math.round((x / y) * maxDim));
  return { width, height, size: `${width}x${height}` };
}

function normalizeImageUrl(data: any) {
  return (
    data.url ||
    data.image_url ||
    data.output?.url ||
    data.data?.[0]?.url ||
    data.data?.[0]?.image_url ||
    data.images?.[0]?.url
  );
}

function normalizeBase64Image(data: any) {
  const base64 = data.data?.[0]?.b64_json || data.image_base64 || data.output?.b64_json;
  if (!base64) return undefined;
  return base64.startsWith('data:image/') ? base64 : `data:image/png;base64,${base64}`;
}

function collectReferenceImages(input: ImageGenerationInput) {
  return [
    ...(input.referenceImages || []),
    input.referenceImageUrl,
    input.referenceImageBase64
  ].filter((item): item is string => Boolean(item));
}

function isDataImageUrl(value: string) {
  return value.startsWith('data:image/');
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function dataUrlToBlob(value: string) {
  const match = value.match(/^data:(image\/[^;]+);base64,(.*)$/);
  if (!match) throw new Error('Invalid data image url');

  const [, mimeType, base64] = match;
  return {
    blob: new Blob([Buffer.from(base64, 'base64')], { type: mimeType }),
    filename: `reference.${mimeType.split('/')[1] || 'png'}`
  };
}

function buildOpenAICompatibleBody(input: ImageGenerationInput) {
  const model = resolveImageModel(input);
  const imageSize = resolveImageSize(input.aspectRatio, input.resolution);
  const referenceImages = collectReferenceImages(input);
  const referenceImage = referenceImages[0];

  return {
    model,
    prompt: input.prompt,
    n: Number(input.metadata?.imageCount || 1),
    size: imageSize.size,
    width: imageSize.width,
    height: imageSize.height,
    quality: input.resolution?.toUpperCase() === '4K' ? 'hd' : 'standard',
    response_format: process.env.IMAGE_RESPONSE_FORMAT || 'b64_json',
    image: referenceImage,
    images: referenceImages,
    reference_image: referenceImage,
    reference_images: referenceImages,
    reference_image_url: input.referenceImageUrl,
    reference_image_base64: input.referenceImageBase64,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    metadata: {
      ...(input.metadata || {}),
      uiModel: input.uiModel,
      resolvedModel: model
    }
  };
}

function buildImageEditJsonBody(input: ImageGenerationInput) {
  const body = buildOpenAICompatibleBody(input);
  const referenceImages = collectReferenceImages(input);

  return {
    ...body,
    images: referenceImages.filter(isHttpUrl).map(imageUrl => ({ image_url: imageUrl })),
    input_fidelity: input.metadata?.inputFidelity || 'high'
  };
}

function buildImageEditFormData(input: ImageGenerationInput) {
  const body = buildOpenAICompatibleBody(input);
  const referenceImages = collectReferenceImages(input);
  const formData = new FormData();

  formData.set('model', body.model);
  formData.set('prompt', body.prompt);
  formData.set('n', String(body.n || 1));
  formData.set('size', body.size);
  formData.set('quality', body.quality);
  formData.set('response_format', body.response_format);
  formData.set('input_fidelity', String(input.metadata?.inputFidelity || 'high'));

  referenceImages.forEach((image, index) => {
    if (isDataImageUrl(image)) {
      const { blob, filename } = dataUrlToBlob(image);
      formData.append('image', blob, `reference-${index}.${filename.split('.').pop() || 'png'}`);
    } else if (isHttpUrl(image)) {
      // The provider supports JSON URL edits. If a mix of data URLs and URLs is
      // ever passed, keep URL values as metadata so the request remains useful.
      formData.append(`image_url_${index}`, image);
    }
  });

  return formData;
}

async function requestJson(endpoint: string, body: Record<string, unknown>) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${requireEnv('IMAGE_API_KEY')}`
    },
    body: JSON.stringify(body)
  });
}

async function requestMultipart(endpoint: string, body: FormData) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('IMAGE_API_KEY')}`
    },
    body
  });
}

export async function submitImageGeneration(input: ImageGenerationInput): Promise<ProviderTaskResult> {
  const provider = input.provider || process.env.IMAGE_PROVIDER || 'openai-compatible';
  const referenceImages = collectReferenceImages(input);
  const hasReferenceImages = referenceImages.length > 0;
  const hasDataUrlReferences = referenceImages.some(isDataImageUrl);
  const endpoint = `${getImageApiBaseUrl()}${hasReferenceImages ? getImageEditPath() : getImageSubmitPath()}`;
  const body = hasReferenceImages ? buildImageEditJsonBody(input) : buildOpenAICompatibleBody(input);

  const response = hasReferenceImages && hasDataUrlReferences
    ? await requestMultipart(endpoint, buildImageEditFormData(input))
    : await requestJson(endpoint, body);

  const raw = await response.json().catch(async () => ({ text: await response.text() }));
  if (!response.ok) {
    throw new Error(`Image provider request failed (${response.status}): ${JSON.stringify(raw)}`);
  }

  const data = raw as any;
  const url = normalizeImageUrl(data);
  const base64Url = normalizeBase64Image(data);

  return {
    provider,
    providerTaskId: data.task_id || data.id || data.data?.[0]?.id,
    status: data.status || (url || base64Url ? 'succeeded' : 'submitted'),
    url: url || base64Url,
    raw: {
      ...data,
      request: {
        provider,
        model: body.model,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        size: body.size,
        endpoint: hasReferenceImages ? getImageEditPath() : getImageSubmitPath(),
        mode: hasReferenceImages ? 'edit' : 'generation',
        referenceImageCount: referenceImages.length
      }
    }
  };
}
