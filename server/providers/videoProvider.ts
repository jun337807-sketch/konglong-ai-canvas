import { ProviderTaskResult, VideoGenerationInput } from './types.js';
import { ingestExternalUrlToTos } from '../services/assetIngestService.js';

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少视频接口环境变量：${name}`);
  return value;
}

function getVideoApiBaseUrl() {
  return (process.env.VIDEO_API_BASE_URL || 'https://api.mjapi.cc.cd').replace(/\/$/, '');
}

function getVideoSubmitPath() {
  return process.env.VIDEO_API_SUBMIT_PATH || '/v1/monthly/generate';
}

function getVideoQueryPath() {
  return process.env.VIDEO_API_QUERY_PATH || '/v1/monthly/task';
}

function getVideoModel() {
  return process.env.VIDEO_MODEL || 'r_sd2';
}

function getVideoResolution(input: VideoGenerationInput) {
  const value = String(input.metadata?.resolution || process.env.VIDEO_RESOLUTION || '720p').toLowerCase();
  return value === '480p' ? '480p' : '720p';
}

function clampDuration(value?: number) {
  const duration = Number(value || process.env.VIDEO_DURATION || 10);
  if (!Number.isFinite(duration)) return 10;
  return Math.min(15, Math.max(4, Math.round(duration)));
}

function inferReferenceType(url: string): 'image' | 'video' | 'audio' {
  const normalized = String(url).toLowerCase();
  if (normalized.startsWith('data:audio/') || normalized.match(/\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/)) return 'audio';
  return normalized.match(/\.(mp4|mov|webm)(\?|$)/) ? 'video' : 'image';
}

function inferSafeExtension(url: string, type: 'image' | 'video' | 'audio') {
  const fallback = type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'jpg';
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!ext) return fallback;
    if (type === 'video' && ['mp4', 'mov', 'webm'].includes(ext)) return ext;
    if (type === 'audio' && ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return ext;
    if (type === 'image' && ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return ext;
  } catch {
    // keep fallback
  }
  return fallback;
}

function normalizeReferenceUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname
      .split('/')
      .map(segment => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
    return parsed.toString();
  } catch {
    return url;
  }
}

function hasNonAsciiUrlPart(url: string) {
  return /[^\x00-\x7F]/.test(url);
}

function normalizeReferenceRole(value?: string) {
  const normalized = String(value || '').toLowerCase();
  if (['character', 'scene', 'prop', 'last_frame', 'style'].includes(normalized)) return normalized;
  return 'style';
}

async function prepareReferenceUrl(url: string, type: 'image' | 'video' | 'audio') {
  const normalizedUrl = normalizeReferenceUrl(url);
  const shouldIngest =
    process.env.VIDEO_REFERENCE_INGEST_TO_TOS === 'true' ||
    hasNonAsciiUrlPart(url);

  if (!shouldIngest) return normalizedUrl;

  try {
    const ingested = await ingestExternalUrlToTos({
      sourceUrl: normalizedUrl,
      assetType: type,
      provider: 'video-reference'
    });
    return ingested.url;
  } catch (err) {
    console.warn('Failed to sanitize video reference through TOS, using encoded URL:', err);
    return normalizedUrl;
  }
}

function buildAuthHeaders() {
  const apiKey = requireEnv('VIDEO_API_KEY');
  const authMode = process.env.VIDEO_API_AUTH_MODE || 'monthly-key';
  return authMode === 'bearer'
    ? { Authorization: `Bearer ${apiKey}` }
    : { 'X-Monthly-Key': apiKey };
}

function toChineseVideoError(status: number, raw: any) {
  const providerMessage =
    raw?.error ||
    raw?.message ||
    raw?.error?.message ||
    raw?.text ||
    JSON.stringify(raw || {});

  const prefix = '视频生成失败';

  if (status === 400) return `${prefix}：请求参数不被接口支持，请检查 VIDEO_MODEL 是否为 r_sd2，分辨率是否为 480p/720p。服务返回：${providerMessage}`;
  if (status === 401) return `${prefix}：视频 API Key 缺失、无效或已被禁用，请检查 VIDEO_API_KEY。服务返回：${providerMessage}`;
  if (status === 403) return `${prefix}：视频 API Key 已过期，请在第三方后台续费或更换 Key。服务返回：${providerMessage}`;
  if (status === 429) return `${prefix}：当前 Key 并发已满，请稍后重试。服务返回：${providerMessage}`;
  if (status === 503) return `${prefix}：视频服务账号池繁忙或上游提交失败，请稍后重试。服务返回：${providerMessage}`;
  if (status >= 500) return `${prefix}：视频服务端创建任务失败，请稍后重试。服务返回：${providerMessage}`;

  return `${prefix}：${providerMessage}`;
}

function normalizeVideoResult(raw: any, provider: string): ProviderTaskResult {
  const statusMap: Record<string, ProviderTaskResult['status']> = {
    queued: 'processing',
    pending: 'processing',
    polling: 'processing',
    running: 'processing',
    processing: 'processing',
    submitted: 'submitted',
    succeeded: 'succeeded',
    success: 'succeeded',
    completed: 'succeeded',
    failed: 'failed',
    error: 'failed'
  };

  const rawStatus = raw?.status || raw?.state || 'submitted';
  const status = statusMap[String(rawStatus).toLowerCase()] || 'submitted';
  const videoUrl =
    raw?.result?.url ||
    raw?.result?.urls?.[0] ||
    raw?.content?.video_url?.url ||
    raw?.content?.video_url ||
    raw?.video_url ||
    raw?.output?.video_url ||
    raw?.url;

  return {
    provider,
    providerTaskId: raw?.task_id || raw?.id,
    status,
    url: typeof videoUrl === 'string' ? videoUrl : videoUrl?.url,
    errorMessage: raw?.error || raw?.error?.message || raw?.fail_reason || null,
    raw
  };
}

async function buildMonthlyPayload(input: VideoGenerationInput) {
  const referenceRoles = Array.isArray(input.referenceRoles)
    ? input.referenceRoles
    : Array.isArray(input.metadata?.referenceRoles)
      ? input.metadata.referenceRoles as string[]
      : [];
  const files = await Promise.all((input.imageUrls || [])
    .filter(Boolean)
    .slice(0, 8)
    .map(async (url, index) => {
      const type = inferReferenceType(url);
      if (type === 'audio' && process.env.VIDEO_REFERENCE_AUDIO_ENABLED === 'false') {
        throw new Error('当前视频接口已关闭音频参考。若第三方确认支持音频，请在服务器 .env 设置 VIDEO_REFERENCE_AUDIO_ENABLED=true 后重启服务。');
      }
      const safeUrl = await prepareReferenceUrl(url, type);
      const ext = inferSafeExtension(safeUrl, type);
      const role = normalizeReferenceRole(referenceRoles[index]);
      return {
        url: safeUrl,
        type,
        name: `ref_${index + 1}.${ext}`,
        role
      };
    }));

  const cleanOutputConstraints =
    input.cleanOutputConstraints === true ||
    input.metadata?.cleanOutputConstraints === true;
  const finalPrompt = [
    input.prompt,
    ...(cleanOutputConstraints
      ? [
          '',
          '生成约束：保持无字幕，不要生成水印，不要生成Logo。'
        ]
      : [])
  ].join('\n');

  return {
    prompt: finalPrompt,
    model: getVideoModel(),
    ratio: input.ratio || '16:9',
    duration: clampDuration(input.duration),
    resolution: getVideoResolution(input),
    ...(files.length > 0 ? { files: files.map(({ role, ...file }) => file) } : {})
  };
}

export async function submitVideoGeneration(input: VideoGenerationInput): Promise<ProviderTaskResult> {
  const provider = input.provider || process.env.VIDEO_PROVIDER || 'mjapi-monthly';
  const endpoint = `${getVideoApiBaseUrl()}${getVideoSubmitPath()}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders()
    },
    body: JSON.stringify(await buildMonthlyPayload(input))
  });

  const raw = await response.json().catch(async () => ({ text: await response.text() }));
  if (!response.ok) {
    throw new Error(toChineseVideoError(response.status, raw));
  }

  return normalizeVideoResult(raw, provider);
}

export async function queryVideoGeneration(providerTaskId: string, provider = process.env.VIDEO_PROVIDER || 'mjapi-monthly'): Promise<ProviderTaskResult> {
  const endpoint = `${getVideoApiBaseUrl()}${getVideoQueryPath()}/${encodeURIComponent(providerTaskId)}`;
  const response = await fetch(endpoint, {
    headers: buildAuthHeaders()
  });

  const raw = await response.json().catch(async () => ({ text: await response.text() }));
  if (!response.ok) {
    throw new Error(toChineseVideoError(response.status, raw));
  }

  const result = normalizeVideoResult(raw, provider);
  if (result.status === 'failed') {
    result.errorMessage = raw?.error ? `视频生成失败：${raw.error}` : '视频生成失败：第三方服务返回失败状态。';
  }
  if (result.status === 'succeeded' && !result.url) {
    result.status = 'failed';
    result.errorMessage = '视频生成失败：第三方服务显示成功，但没有返回视频地址。';
  }

  return result;
}
