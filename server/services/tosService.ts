import { TosClient } from '@volcengine/tos-sdk';

let client: TosClient | null = null;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getBucketName() {
  return requireEnv('TOS_BUCKET');
}

export function getTosEndpoint() {
  return process.env.TOS_ENDPOINT || 'tos-cn-beijing.volces.com';
}

export function getTosRegion() {
  return process.env.TOS_REGION || 'cn-beijing';
}

export function getTosPublicBaseUrl() {
  return process.env.TOS_PUBLIC_BASE_URL || `https://${getBucketName()}.${getTosEndpoint()}`;
}

export function getTosClient() {
  if (!client) {
    client = new TosClient({
      accessKeyId: requireEnv('TOS_ACCESS_KEY_ID'),
      accessKeySecret: requireEnv('TOS_ACCESS_KEY_SECRET'),
      region: getTosRegion(),
      endpoint: getTosEndpoint(),
    });
  }
  return client;
}

export async function putObjectToTos(input: {
  key: string;
  body: Buffer;
  contentType?: string;
}) {
  const bucket = getBucketName();
  await getTosClient().putObject({
    bucket,
    key: input.key,
    body: input.body,
    contentType: input.contentType
  });

  return {
    bucket,
    key: input.key,
    url: `${getTosPublicBaseUrl().replace(/\/$/, '')}/${input.key}`
  };
}
