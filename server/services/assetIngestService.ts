import path from 'path';
import { putObjectToTos } from './tosService.js';

const DEFAULT_MAX_BYTES = 200 * 1024 * 1024;

function inferExtension(contentType: string | null, sourceUrl: string, fallback: string) {
  const fromType = contentType?.split('/')[1]?.split(';')[0];
  if (fromType) {
    if (fromType === 'jpeg') return 'jpg';
    if (fromType === 'quicktime') return 'mov';
    return fromType;
  }

  const ext = path.extname(new URL(sourceUrl).pathname).replace('.', '');
  return ext || fallback;
}

export async function ingestExternalUrlToTos(input: {
  sourceUrl: string;
  assetType: 'image' | 'video' | 'audio' | 'document';
  provider?: string;
  providerTaskId?: string;
}) {
  const response = await fetch(input.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated asset: ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  const maxBytes = Number(process.env.ASSET_INGEST_MAX_BYTES || DEFAULT_MAX_BYTES);
  if (contentLength && contentLength > maxBytes) {
    throw new Error(`Generated asset is too large to ingest (${contentLength} bytes)`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    throw new Error(`Generated asset is too large to ingest (${arrayBuffer.byteLength} bytes)`);
  }

  const contentType = response.headers.get('content-type');
  const fallbackExt = input.assetType === 'video' ? 'mp4' : input.assetType === 'image' ? 'png' : 'bin';
  const ext = inferExtension(contentType, input.sourceUrl, fallbackExt);
  const safeProvider = (input.provider || 'provider').replace(/[^a-zA-Z0-9_-]/g, '-');
  const key = `generated/${input.assetType}/${safeProvider}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  return putObjectToTos({
    key,
    body: Buffer.from(arrayBuffer),
    contentType: contentType || undefined
  });
}
