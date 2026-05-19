export type UploadableMediaType = 'image' | 'video';

function isPublicUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function extensionFromMime(mimeType: string, mediaType: UploadableMediaType) {
  const subtype = mimeType.split('/')[1]?.split(';')[0]?.toLowerCase();
  if (subtype) {
    if (subtype === 'jpeg') return 'jpg';
    if (/^[a-z0-9]+$/.test(subtype)) return subtype;
  }
  return mediaType === 'video' ? 'mp4' : 'jpg';
}

async function blobFromDataUrl(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function blobFromLocalUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('本地素材读取失败');
  return response.blob();
}

export async function ensurePublicMediaUrl(
  url: string,
  mediaType: UploadableMediaType,
  index = 0
) {
  if (isPublicUrl(url)) return url;

  const blob = url.startsWith('data:')
    ? await blobFromDataUrl(url)
    : await blobFromLocalUrl(url);

  const extension = extensionFromMime(blob.type, mediaType);
  const safeName = `ref_${index + 1}.${extension}`;
  const formData = new FormData();
  formData.append('file', blob, safeName);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || !result?.url) {
    throw new Error(result?.error || '参考素材上传到 TOS 失败');
  }

  return result.url as string;
}
