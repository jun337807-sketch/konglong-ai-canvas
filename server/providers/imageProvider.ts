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

function getMjApiBaseUrl() {
  return (process.env.IMAGE_MJ_API_BASE_URL || process.env.IMAGE_API_BASE_URL || '').replace(/\/$/, '');
}

function getMjSubmitPath() {
  return process.env.IMAGE_MJ_SUBMIT_PATH || '/mj/submit/imagine';
}

function getMjTaskPath(taskId: string) {
  const template = process.env.IMAGE_MJ_TASK_PATH_TEMPLATE || '/mj/task/{taskId}/fetch';
  return template.replace('{taskId}', encodeURIComponent(taskId));
}

function getMjProtocol() {
  return (process.env.IMAGE_MJ_PROTOCOL || 'openai-compatible').trim().toLowerCase();
}

function normalizeUiModel(value?: string) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveBanana2Model(resolution?: string) {
  const normalizedResolution = (resolution || '').trim().toUpperCase();
  if (normalizedResolution === '4K') {
    return process.env.IMAGE_MODEL_KONGLONG_BANANA_2_4K
      || process.env.IMAGE_MODEL_KONGLONG_BANANA_2
      || 'gemini-3.1-flash-image-preview-4k';
  }
  if (normalizedResolution === '2K') {
    return process.env.IMAGE_MODEL_KONGLONG_BANANA_2_2K
      || process.env.IMAGE_MODEL_KONGLONG_BANANA_2
      || 'gemini-3.1-flash-image-preview-2k';
  }
  return process.env.IMAGE_MODEL_KONGLONG_BANANA_2 || 'gemini-3.1-flash-image-preview';
}

function resolveImageModel(input: ImageGenerationInput) {
  if (input.model) return input.model;

  const uiModel = normalizeUiModel(input.uiModel || String(input.metadata?.uiModel || ''));

  if (uiModel.includes('banana pro')) {
    return process.env.IMAGE_MODEL_KONGLONG_BANANA_PRO || 'gemini-3-pro-image-preview';
  }

  if (uiModel.includes('banana 2') || uiModel.includes('banan 2')) {
    return resolveBanana2Model(input.resolution);
  }

  if (uiModel.includes('konglong mj')) {
    return process.env.IMAGE_MODEL_KONGLONG_MJ || 'mj_imagine';
  }

  if (uiModel.includes('konglong image')) {
    return process.env.IMAGE_MODEL_KONGLONG_IMAGE || process.env.IMAGE_MODEL || 'gpt-image-2';
  }

  return process.env.IMAGE_MODEL || process.env.IMAGE_MODEL_KONGLONG_IMAGE || 'gpt-image-2';
}

function isMjImageInput(input: ImageGenerationInput) {
  const uiModel = normalizeUiModel(input.uiModel || String(input.metadata?.uiModel || ''));
  const explicitModel = (input.model || '').trim().toLowerCase();
  return uiModel.includes('konglong mj') || explicitModel === 'mj_imagine' || resolveImageModel(input) === 'mj_imagine';
}

function resolveImageApiKey(input: ImageGenerationInput) {
  const uiModel = normalizeUiModel(input.uiModel || String(input.metadata?.uiModel || ''));
  const resolution = (input.resolution || '').trim().toUpperCase();

  if (uiModel.includes('banana pro')) {
    return process.env.IMAGE_API_KEY_KONGLONG_BANANA_PRO || requireEnv('IMAGE_API_KEY');
  }

  if (uiModel.includes('banana 2') || uiModel.includes('banan 2')) {
    if (resolution === '4K') {
      return process.env.IMAGE_API_KEY_KONGLONG_BANANA_2_4K
        || process.env.IMAGE_API_KEY_KONGLONG_BANANA_2
        || requireEnv('IMAGE_API_KEY');
    }
    if (resolution === '2K') {
      return process.env.IMAGE_API_KEY_KONGLONG_BANANA_2_2K
        || process.env.IMAGE_API_KEY_KONGLONG_BANANA_2
        || requireEnv('IMAGE_API_KEY');
    }
    return process.env.IMAGE_API_KEY_KONGLONG_BANANA_2 || requireEnv('IMAGE_API_KEY');
  }

  if (uiModel.includes('konglong mj')) {
    return process.env.IMAGE_API_KEY_KONGLONG_MJ || requireEnv('IMAGE_API_KEY');
  }

  if (uiModel.includes('konglong image')) {
    return process.env.IMAGE_API_KEY_KONGLONG_IMAGE || requireEnv('IMAGE_API_KEY');
  }

  return requireEnv('IMAGE_API_KEY');
}

function resolveImageSize(aspectRatio = '1:1', resolution = '1K'): ImageSize {
  const maxDimByResolution: Record<string, number> = {
    '1K': 1024,
    '2K': 2048,
    // duolapi / gpt-image compatible routes reject sizes whose longest edge is
    // greater than 3840. Keep the UI label as 4K, but request the provider-safe
    // maximum to avoid "Invalid size" errors.
    '4K': Number(process.env.IMAGE_MAX_EDGE_PIXELS || 3840),
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

function buildProviderPrompt(prompt: string, aspectRatio = '1:1', resolution = '1K') {
  const normalizedRatio = !aspectRatio || aspectRatio === '自适应' || aspectRatio === 'Auto' ? '1:1' : aspectRatio;
  const ratioText = normalizedRatio === '9:16'
    ? '9:16 vertical portrait composition'
    : normalizedRatio === '16:9'
      ? '16:9 horizontal landscape composition'
      : `${normalizedRatio} composition`;
  const resolutionText = resolution.toUpperCase() === '4K'
    ? 'true 4K ultra high resolution, sharp details'
    : resolution.toUpperCase() === '2K'
      ? 'true 2K high resolution, clear details'
      : 'high resolution';
  const promptWithoutConflictingRatio = prompt
    .replace(/(?:^|[\s，,；;、])(?:\d{1,2}\s*[:：]\s*\d{1,2})(?=[\s，,；;、]|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return [
    promptWithoutConflictingRatio || prompt,
    '',
    `Hard requirement: generate in ${ratioText}. Ignore any conflicting aspect ratio in the user prompt.`,
    `Hard requirement: ${resolutionText}. Do not stretch, distort, blur, or upscale a low-resolution image.`
  ].join('\n');
}

function buildMjPrompt(prompt: string, aspectRatio = '1:1') {
  const normalizedRatio = !aspectRatio || aspectRatio === '自适应' || aspectRatio === 'Auto' ? '' : aspectRatio;
  const promptWithoutConflictingRatio = prompt
    .replace(/\s--ar\s+\d{1,2}\s*:\s*\d{1,2}/gi, ' ')
    .replace(/(?:^|[\s，,；;、])(?:\d{1,2}\s*[:：]\s*\d{1,2})(?=[\s，,；;、]|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return normalizedRatio
    ? `${promptWithoutConflictingRatio || prompt} --ar ${normalizedRatio}`
    : (promptWithoutConflictingRatio || prompt);
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
    prompt: buildProviderPrompt(input.prompt, input.aspectRatio, input.resolution),
    n: Number(input.metadata?.imageCount || 1),
    size: imageSize.size,
    image_size: imageSize.size,
    dimensions: imageSize.size,
    width: imageSize.width,
    height: imageSize.height,
    quality: input.resolution?.toUpperCase() === '4K' ? 'hd' : 'standard',
    output_quality: input.resolution?.toUpperCase() === '1K' ? 'standard' : 'high',
    response_format: process.env.IMAGE_RESPONSE_FORMAT || 'b64_json',
    image: referenceImage,
    images: referenceImages,
    reference_image: referenceImage,
    reference_images: referenceImages,
    reference_image_url: input.referenceImageUrl,
    reference_image_base64: input.referenceImageBase64,
    aspect_ratio: input.aspectRatio,
    aspectRatio: input.aspectRatio,
    ratio: input.aspectRatio,
    resolution: input.resolution,
    output_resolution: input.resolution,
    metadata: {
      ...(input.metadata || {}),
      uiModel: input.uiModel,
      resolvedModel: model,
      requestedWidth: imageSize.width,
      requestedHeight: imageSize.height,
      requestedSize: imageSize.size
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

async function requestJson(endpoint: string, body: Record<string, unknown>, apiKey = requireEnv('IMAGE_API_KEY')) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
}

async function requestMultipart(endpoint: string, body: FormData, apiKey = requireEnv('IMAGE_API_KEY')) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body
  });
}

async function requestMjJson(endpoint: string, body: Record<string, unknown>, apiKey = requireEnv('IMAGE_API_KEY')) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
}

async function queryMjTask(baseUrl: string, taskId: string, apiKey = requireEnv('IMAGE_API_KEY')) {
  const primaryPath = getMjTaskPath(taskId);
  const fallbackPath = `/mj/task/${encodeURIComponent(taskId)}`;
  const paths = primaryPath === fallbackPath ? [primaryPath] : [primaryPath, fallbackPath];
  let lastError: { status: number; endpoint: string; body: any } | undefined;

  for (const path of paths) {
    const endpoint = `${baseUrl}${path}`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const body = await response.json().catch(async () => ({ text: await response.text() }));

    if (response.ok) {
      return { body, endpoint };
    }

    lastError = { status: response.status, endpoint, body };
    if (response.status !== 404) break;
  }

  throw new Error(`MJ query failed (${lastError?.status}) endpoint=${lastError?.endpoint}: ${JSON.stringify(lastError?.body)}`);
}

async function submitMjImagineGeneration(input: ImageGenerationInput): Promise<ProviderTaskResult> {
  const baseUrl = getMjApiBaseUrl();
  if (!baseUrl) throw new Error('Missing required environment variable: IMAGE_MJ_API_BASE_URL or IMAGE_API_BASE_URL');

  const provider = input.provider || process.env.IMAGE_PROVIDER || 'mj-proxy';
  const submitEndpoint = `${baseUrl}${getMjSubmitPath()}`;
  const prompt = buildMjPrompt(input.prompt, input.aspectRatio);
  const apiKey = resolveImageApiKey(input);

  const submitResponse = await requestMjJson(submitEndpoint, {
    prompt,
    state: JSON.stringify({
      uiModel: input.uiModel,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution
    })
  }, apiKey);
  const submitRaw = await submitResponse.json().catch(async () => ({ text: await submitResponse.text() }));
  if (!submitResponse.ok) {
    throw new Error(`MJ submit failed (${submitResponse.status}) endpoint=${submitEndpoint}: ${JSON.stringify(submitRaw)}`);
  }

  const taskId = String((submitRaw as any).result || (submitRaw as any).id || '');
  const submitCode = Number((submitRaw as any).code);
  if (!taskId || ![1, 22].includes(submitCode)) {
    throw new Error(`MJ submit rejected endpoint=${submitEndpoint}: ${JSON.stringify(submitRaw)}`);
  }

  const timeoutMs = Number(process.env.IMAGE_MJ_POLL_TIMEOUT_MS || 180000);
  const intervalMs = Number(process.env.IMAGE_MJ_POLL_INTERVAL_MS || 3000);
  const startedAt = Date.now();
  let lastTask: any = submitRaw;

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    const { body: task, endpoint: queryEndpoint } = await queryMjTask(baseUrl, taskId, apiKey);
    lastTask = task;

    if (task.status === 'SUCCESS' && task.imageUrl) {
      return {
        provider,
        providerTaskId: taskId,
        status: 'succeeded',
        url: task.imageUrl,
        raw: {
          ...task,
          request: {
            provider,
            model: 'mj_imagine',
            endpoint: getMjSubmitPath(),
            queryEndpoint: getMjTaskPath(taskId),
            aspectRatio: input.aspectRatio
          }
        }
      };
    }

    if (task.status === 'FAILURE' || task.status === 'CANCEL') {
      return {
        provider,
        providerTaskId: taskId,
        status: 'failed',
        errorMessage: task.failReason || task.description || 'MJ task failed',
        raw: task
      };
    }
  }

  return {
    provider,
    providerTaskId: taskId,
    status: 'failed',
    errorMessage: `MJ task timeout after ${timeoutMs}ms`,
    raw: lastTask
  };
}

export async function submitImageGeneration(input: ImageGenerationInput): Promise<ProviderTaskResult> {
  if (isMjImageInput(input) && getMjProtocol() === 'mj-proxy') {
    return submitMjImagineGeneration(input);
  }

  const provider = input.provider || process.env.IMAGE_PROVIDER || 'openai-compatible';
  const referenceImages = collectReferenceImages(input);
  const hasReferenceImages = referenceImages.length > 0;
  const hasDataUrlReferences = referenceImages.some(isDataImageUrl);
  const endpoint = `${getImageApiBaseUrl()}${hasReferenceImages ? getImageEditPath() : getImageSubmitPath()}`;
  const body = hasReferenceImages ? buildImageEditJsonBody(input) : buildOpenAICompatibleBody(input);
  const apiKey = resolveImageApiKey(input);

  const response = hasReferenceImages && hasDataUrlReferences
    ? await requestMultipart(endpoint, buildImageEditFormData(input), apiKey)
    : await requestJson(endpoint, body, apiKey);

  const raw = await response.json().catch(async () => ({ text: await response.text() }));
  if (!response.ok) {
    throw new Error(`Image provider request failed (${response.status}) model=${body.model} endpoint=${endpoint} size=${body.size}: ${JSON.stringify(raw)}`);
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
