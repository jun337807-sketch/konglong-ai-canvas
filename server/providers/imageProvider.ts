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

function getGrsaiApiBaseUrl() {
  return (process.env.IMAGE_GRSAI_API_BASE_URL || 'https://grsaiapi.com').replace(/\/$/, '');
}

function getGrsaiSubmitPath() {
  return process.env.IMAGE_GRSAI_SUBMIT_PATH || '/v1/api/generate';
}

function getGrsaiResultPath() {
  return process.env.IMAGE_GRSAI_RESULT_PATH || '/v1/api/result';
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
  const requestedResolution = String(input.resolution || input.metadata?.resolution || '1K').toUpperCase();

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
    if (requestedResolution === '4K') {
      return process.env.IMAGE_MODEL_KONGLONG_IMAGE_4K
        || process.env.IMAGE_MODEL_KONGLONG_IMAGE_VIP
        || 'gpt-image-2-vip';
    }

    if (requestedResolution === '2K') {
      return process.env.IMAGE_MODEL_KONGLONG_IMAGE_2K
        || process.env.IMAGE_MODEL_KONGLONG_IMAGE_VIP
        || 'gpt-image-2-vip';
    }

    return process.env.IMAGE_MODEL_KONGLONG_IMAGE || process.env.IMAGE_MODEL || 'gpt-image-2';
  }

  return process.env.IMAGE_MODEL || process.env.IMAGE_MODEL_KONGLONG_IMAGE || 'gpt-image-2';
}

function isMjImageInput(input: ImageGenerationInput) {
  const uiModel = normalizeUiModel(input.uiModel || String(input.metadata?.uiModel || ''));
  const explicitModel = (input.model || '').trim().toLowerCase();
  return uiModel.includes('konglong mj') || explicitModel === 'mj_imagine' || resolveImageModel(input) === 'mj_imagine';
}

function looksLikeGrsaiImageModel(model: string) {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith('gpt-image-2')
    || normalized.startsWith('nano-banana')
    || normalized.startsWith('gemini-');
}

function hasGrsaiConfig() {
  return Boolean(process.env.IMAGE_API_KEY_GRSAI)
    || Boolean(process.env.IMAGE_GRSAI_API_BASE_URL)
    || String(process.env.IMAGE_API_BASE_URL || '').toLowerCase().includes('grsai');
}

function shouldForceGrsaiProvider(input: ImageGenerationInput) {
  if (isMjImageInput(input)) return false;
  const explicitModel = (input.model || '').trim();
  const resolvedModel = resolveImageModel(input).trim();
  const uiModel = normalizeUiModel(input.uiModel || String(input.metadata?.uiModel || ''));
  return hasGrsaiConfig()
    && (
      looksLikeGrsaiImageModel(explicitModel)
      || looksLikeGrsaiImageModel(resolvedModel)
      || uiModel.includes('konglong image')
      || uiModel.includes('banana pro')
      || uiModel.includes('banana 2')
      || uiModel.includes('banan 2')
    );
}

function resolveImageProvider(input: ImageGenerationInput) {
  const uiModel = normalizeUiModel(input.uiModel || String(input.metadata?.uiModel || ''));
  const explicitModel = (input.model || '').trim().toLowerCase();
  const resolvedModel = resolveImageModel(input).trim().toLowerCase();
  const looksLikeGrsaiModel = [explicitModel, resolvedModel].some(looksLikeGrsaiImageModel);
  const looksLikeGrsaiEndpoint = [
    process.env.IMAGE_GRSAI_API_BASE_URL,
    process.env.IMAGE_API_BASE_URL
  ].some(value => String(value || '').toLowerCase().includes('grsai'));
  const grsaiFallback = (
    process.env.IMAGE_PROVIDER === 'grsai'
    || process.env.IMAGE_API_KEY_GRSAI
    || process.env.IMAGE_GRSAI_API_BASE_URL
    || (looksLikeGrsaiEndpoint && looksLikeGrsaiModel)
  ) ? 'grsai' : undefined;

  // 关键修复：
  // 如果当前模型属于 Grsai 文档里的 gpt-image-2 / nano-banana / gemini 系列，
  // 并且服务器已经配置了 Grsai Key/Base URL，就必须走 Grsai 的 /v1/api/generate + /v1/api/result。
  // 否则即使服务商后台已成功，本地会被错误地当成 openai-compatible 任务，永远无法查回结果。
  if (shouldForceGrsaiProvider(input)) {
    return 'grsai';
  }

  if (uiModel.includes('banana pro')) {
    return process.env.IMAGE_PROVIDER_KONGLONG_BANANA_PRO || grsaiFallback || process.env.IMAGE_PROVIDER || 'openai-compatible';
  }

  if (uiModel.includes('banana 2') || uiModel.includes('banan 2')) {
    return process.env.IMAGE_PROVIDER_KONGLONG_BANANA_2 || grsaiFallback || process.env.IMAGE_PROVIDER || 'openai-compatible';
  }

  if (uiModel.includes('konglong mj')) {
    return process.env.IMAGE_PROVIDER_KONGLONG_MJ || process.env.IMAGE_PROVIDER || 'openai-compatible';
  }

  if (uiModel.includes('konglong image')) {
    return process.env.IMAGE_PROVIDER_KONGLONG_IMAGE || grsaiFallback || process.env.IMAGE_PROVIDER || 'openai-compatible';
  }

  return input.provider || grsaiFallback || process.env.IMAGE_PROVIDER || 'openai-compatible';
}
function resolveImageApiKey(input: ImageGenerationInput) {
  const uiModel = normalizeUiModel(input.uiModel || String(input.metadata?.uiModel || ''));
  const resolution = (input.resolution || '').trim().toUpperCase();

  if (shouldForceGrsaiProvider(input)) {
    return process.env.IMAGE_API_KEY_GRSAI || requireEnv('IMAGE_API_KEY');
  }

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

function buildGrsaiBody(input: ImageGenerationInput) {
  const model = resolveImageModel(input);
  const referenceImages = collectReferenceImages(input);
  const normalizedAspectRatio = !input.aspectRatio || input.aspectRatio === '鑷€傚簲' || input.aspectRatio === 'Auto'
    ? 'auto'
    : input.aspectRatio;
  const normalizedImageSize = (input.resolution || '1K').toUpperCase();
  const grsaiAspectRatio = model.includes('gpt-image-2')
    ? resolveGrsaiGptImageAspectRatio(model, normalizedAspectRatio, normalizedImageSize)
    : normalizedAspectRatio;

  return {
    model,
    prompt: input.prompt,
    images: referenceImages,
    aspectRatio: grsaiAspectRatio,
    imageSize: ['1K', '2K', '4K'].includes(normalizedImageSize) ? normalizedImageSize : '1K',
    // Grsai 的 json 模式会阻塞到图片生成完成；gpt-image-2-vip / nano-banana-pro
    // 常见耗时 2~8 分钟，容易被浏览器、Nginx 或上游网关切断，造成“服务商已成功、本地永远生成中”。
    // 默认必须使用 async：先拿 providerTaskId，再由本地任务队列/后台 followup 查询并回写结果。
    replyType: process.env.IMAGE_GRSAI_REPLY_TYPE || 'async'
  };
}

function resolveGrsaiGptImageAspectRatio(model: string, aspectRatio: string, imageSize: string) {
  const normalizedRatio = aspectRatio === 'auto' ? '1:1' : aspectRatio;
  const normalizedSize = ['1K', '2K', '4K'].includes(imageSize) ? imageSize : '1K';

  const gptImage2Pixels: Record<string, string> = {
    '1:1': '1024x1024',
    '16:9': '1672x941',
    '9:16': '941x1672',
    '4:3': '1443x1090',
    '3:4': '1090x1443',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
    '5:4': '1408x1120',
    '4:5': '1120x1408',
    '21:9': '1920x832',
    '9:21': '832x1920',
    '1:2': '896x1792',
    '2:1': '1792x896'
  };

  const gptImage2VipPixels: Record<string, Record<string, string>> = {
    '1:1': { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
    '16:9': { '1K': '1280x720', '2K': '2048x1152', '4K': '3840x2160' },
    '9:16': { '1K': '720x1280', '2K': '1152x2048', '4K': '2160x3840' },
    '4:3': { '1K': '1152x864', '2K': '2304x1728', '4K': '3264x2448' },
    '3:4': { '1K': '864x1152', '2K': '1728x2304', '4K': '2448x3264' },
    '3:2': { '1K': '1536x1024', '2K': '2048x1360', '4K': '3504x2336' },
    '2:3': { '1K': '1024x1536', '2K': '1360x2048', '4K': '2336x3504' },
    '5:4': { '1K': '1120x896', '2K': '2240x1792', '4K': '3200x2560' },
    '4:5': { '1K': '896x1120', '2K': '1792x2240', '4K': '2560x3200' },
    '21:9': { '1K': '1456x624', '2K': '2912x1248', '4K': '3840x1648' },
    '9:21': { '1K': '624x1456', '2K': '1248x2912', '4K': '1648x3840' },
    '1:3': { '2K': '688x2048', '4K': '1280x3840' },
    '3:1': { '2K': '2048x688', '4K': '3840x1280' },
    '2:1': { '1K': '1536x768', '2K': '3072x1536', '4K': '3840x1920' },
    '1:2': { '1K': '768x1536', '2K': '1536x3072', '4K': '1920x3840' }
  };

  if (model.includes('vip')) {
    return gptImage2VipPixels[normalizedRatio]?.[normalizedSize]
      || gptImage2VipPixels[normalizedRatio]?.['1K']
      || '1024x1024';
  }

  return gptImage2Pixels[normalizedRatio] || normalizedRatio;
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

function looksLikeGeneratedMediaUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return false;
  const clean = value.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|webp|gif|avif|bmp|mp4|mov|webm)$/i.test(clean)
    || /\/file\//i.test(value)
    || /aitohumanize|grsai|tos-|volces|volc|cdn|image|img|media|oss|cos/i.test(value);
}

function findGeneratedMediaUrl(value: any, depth = 0): string | undefined {
  if (!value || depth > 8) return undefined;

  if (typeof value === 'string') {
    const text = value.trim();
    if (looksLikeGeneratedMediaUrl(text)) return text;
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try {
        return findGeneratedMediaUrl(JSON.parse(text), depth + 1);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findGeneratedMediaUrl(item, depth + 1);
      if (url) return url;
    }
    return undefined;
  }

  if (typeof value !== 'object') return undefined;

  const preferredKeys = [
    'url',
    'imageUrl',
    'image_url',
    'videoUrl',
    'video_url',
    'outputUrl',
    'output_url',
    'fileUrl',
    'file_url',
    'mediaUrl',
    'media_url',
    'resultUrl',
    'result_url'
  ];

  for (const key of preferredKeys) {
    const url = findGeneratedMediaUrl(value[key], depth + 1);
    if (url) return url;
  }

  for (const key of ['results', 'result', 'data', 'output', 'outputs', 'images', 'image', 'media', 'files', 'file', 'raw']) {
    const url = findGeneratedMediaUrl(value[key], depth + 1);
    if (url) return url;
  }

  for (const [key, item] of Object.entries(value)) {
    if (['request', 'prompt', 'input', 'inputs', 'payload'].includes(key)) continue;
    const url = findGeneratedMediaUrl(item, depth + 1);
    if (url) return url;
  }

  return undefined;
}

function normalizeGrsaiUrl(data: any) {
  return data?.results?.[0]?.url || data?.result?.url || data?.url || findGeneratedMediaUrl(data);
}

function normalizeGrsaiStatus(status: unknown): 'running' | 'succeeded' | 'failed' | 'violation' | 'submitted' {
  const normalized = String(status || '').trim().toLowerCase();
  if (['succeeded', 'success', 'completed', '\u6210\u529f', '成功', '鎴愬姛'].includes(normalized)) return 'succeeded';
  if (['failed', 'failure', 'fail', '\u5931\u8d25', '失败', '澶辫触'].includes(normalized)) return 'failed';
  if (['violation', '\u8fdd\u89c4', '违规', '杩濊'].includes(normalized)) return 'violation';
  if (['running', 'processing', '\u8fdb\u884c\u4e2d', '进行中', '杩涜涓?'].includes(normalized)) return 'running';
  return 'submitted';
}
function toGrsaiProviderResult(input: {
  data: any;
  provider: string;
  body: ReturnType<typeof buildGrsaiBody>;
  endpoint: string;
  queryEndpoint?: string;
}): ProviderTaskResult {
  const { data, provider, body, endpoint, queryEndpoint } = input;
  const firstUrl = normalizeGrsaiUrl(data);
  const status = normalizeGrsaiStatus(data.status);

  if (status === 'failed' || status === 'violation') {
    return {
      provider,
      providerTaskId: data.id,
      status: 'failed',
      errorMessage: data.error || (status === 'violation' ? 'Grsai content violation' : 'Grsai generation failed'),
      raw: data
    };
  }

  return {
    provider,
    providerTaskId: data.id,
    status: status === 'succeeded' && firstUrl ? 'succeeded' : 'submitted',
    url: firstUrl,
    raw: {
      ...data,
      request: {
        provider,
        model: body.model,
        endpoint,
        queryEndpoint,
        aspectRatio: body.aspectRatio,
        imageSize: body.imageSize,
        replyType: body.replyType,
        referenceImageCount: body.images.length
      }
    }
  };
}

async function queryGrsaiResult(taskId: string, apiKey: string) {
  const resultPath = getGrsaiResultPath();
  const separator = resultPath.includes('?') ? '&' : '?';
  const endpoint = `${getGrsaiApiBaseUrl()}${resultPath}${separator}id=${encodeURIComponent(taskId)}`;
  const timeoutMs = Number(process.env.IMAGE_GRSAI_QUERY_TIMEOUT_MS || 8000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    },
    signal: controller.signal
  });
  try {
    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }
    if (!response.ok) {
      throw new Error(`Grsai result query failed (${response.status}) endpoint=${endpoint}: ${JSON.stringify(data)}`);
    }
    return { data, endpoint };
  } finally {
    clearTimeout(timeout);
  }
}

async function pollGrsaiResult(input: {
  taskId: string;
  apiKey: string;
  provider: string;
  body: ReturnType<typeof buildGrsaiBody>;
  submitEndpoint: string;
  firstRaw: any;
}): Promise<ProviderTaskResult> {
  const timeoutMs = Number(process.env.IMAGE_GRSAI_POLL_TIMEOUT_MS || 900000);
  const intervalMs = Number(process.env.IMAGE_GRSAI_POLL_INTERVAL_MS || 3000);
  const startedAt = Date.now();
  let lastRaw = input.firstRaw;
  let lastEndpoint: string | undefined;
  let lastError: Error | undefined;

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    try {
      const { data, endpoint } = await queryGrsaiResult(input.taskId, input.apiKey);
      lastRaw = data;
      lastEndpoint = endpoint;
      lastError = undefined;
      const status = normalizeGrsaiStatus(data.status);

      if (status === 'succeeded' || status === 'failed' || status === 'violation') {
        return toGrsaiProviderResult({
          data,
          provider: input.provider,
          body: input.body,
          endpoint: input.submitEndpoint,
          queryEndpoint: endpoint
        });
      }
    } catch (err: any) {
      // Grsai 查询端偶发 502/HTML/网络抖动时，任务本身可能仍在服务商后台成功完成。
      // 不要因为单次查询失败就把画布任务判死，继续轮询直到超时。
      lastError = err instanceof Error ? err : new Error(String(err));
      lastRaw = {
        ...(typeof lastRaw === 'object' && lastRaw ? lastRaw : {}),
        lastPollError: lastError.message
      };
    }
  }

  return {
    provider: input.provider,
    providerTaskId: input.taskId,
    status: 'failed',
    errorMessage: lastError
      ? `Grsai task timeout after ${timeoutMs}ms; last poll error: ${lastError.message}`
      : `Grsai task timeout after ${timeoutMs}ms`,
    raw: lastRaw || { queryEndpoint: lastEndpoint }
  };
}

async function submitGrsaiGeneration(input: ImageGenerationInput): Promise<ProviderTaskResult> {
  const provider = 'grsai';
  const apiKey = process.env.IMAGE_API_KEY_GRSAI || resolveImageApiKey(input);
  const endpoint = `${getGrsaiApiBaseUrl()}${getGrsaiSubmitPath()}`;
  const body = buildGrsaiBody(input);

  const response = await requestJson(endpoint, body, apiKey);
  const raw = await response.json().catch(async () => ({ text: await response.text() }));
  if (!response.ok) {
    throw new Error(`Grsai image request failed (${response.status}) model=${body.model} endpoint=${endpoint}: ${JSON.stringify(raw)}`);
  }

  const data = raw as any;
  const firstUrl = normalizeGrsaiUrl(data);
  const status = normalizeGrsaiStatus(data.status);

  if (status === 'running' && data.id) {
    return {
      provider,
      providerTaskId: String(data.id),
      status: 'submitted',
      raw: {
        ...data,
        request: {
          provider,
          model: body.model,
          endpoint,
          queryEndpoint: `${getGrsaiApiBaseUrl()}${getGrsaiResultPath()}`,
          aspectRatio: body.aspectRatio,
          imageSize: body.imageSize,
          replyType: body.replyType,
          referenceImageCount: body.images.length
        }
      }
    };
  }

  if (status === 'succeeded' && !firstUrl && data.id) {
    return {
      provider,
      providerTaskId: String(data.id),
      status: 'submitted',
      raw: {
        ...data,
        request: {
          provider,
          model: body.model,
          endpoint,
          queryEndpoint: `${getGrsaiApiBaseUrl()}${getGrsaiResultPath()}`,
          aspectRatio: body.aspectRatio,
          imageSize: body.imageSize,
          replyType: body.replyType,
          referenceImageCount: body.images.length
        }
      }
    };
  }

  return toGrsaiProviderResult({ data, provider, body, endpoint });
}

export async function queryImageGeneration(input: ImageGenerationInput & { providerTaskId?: string }): Promise<ProviderTaskResult> {
  const provider = resolveImageProvider(input);
  const taskId = input.providerTaskId;
  if (!taskId) {
    throw new Error('providerTaskId is required');
  }

  const shouldQueryGrsai = provider === 'grsai'
    || (
      provider === 'openai-compatible'
      && (
        Boolean(process.env.IMAGE_API_KEY_GRSAI)
        || Boolean(process.env.IMAGE_GRSAI_API_BASE_URL)
        || String(process.env.IMAGE_API_BASE_URL || '').includes('grsai')
        || /^\d+-[0-9a-f-]{12,}$/i.test(taskId)
      )
    );

  if (shouldQueryGrsai) {
    const apiKey = process.env.IMAGE_API_KEY_GRSAI || resolveImageApiKey(input);
    const body = buildGrsaiBody(input);
    const { data, endpoint } = await queryGrsaiResult(taskId, apiKey);
    return toGrsaiProviderResult({
      data,
      provider,
      body,
      endpoint: `${getGrsaiApiBaseUrl()}${getGrsaiSubmitPath()}`,
      queryEndpoint: endpoint
    });
  }

  return {
    provider,
    providerTaskId: taskId,
    status: 'submitted',
    raw: { message: 'Provider query is not implemented for this image provider yet.' }
  };
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
  const provider = resolveImageProvider(input);

  if (provider === 'grsai') {
    return submitGrsaiGeneration(input);
  }

  if (isMjImageInput(input) && getMjProtocol() === 'mj-proxy') {
    return submitMjImagineGeneration(input);
  }

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
