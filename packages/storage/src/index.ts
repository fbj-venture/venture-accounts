// File uploads to a Railway Bucket - S3-compatible object storage, so this is
// just the AWS S3 client pointed at the bucket's endpoint. Server-only: import
// it from handlers / server modules, never from browser-reachable code.
//
// Storage is optional. Without the S3_* settings (see @app/env) isStorageConfigured()
// is false and uploadFile() throws, so callers that can live without it
// check first.
import { env } from "@app/env";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function getConfig(): Config | undefined {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    return undefined;
  }
  return {
    endpoint: S3_ENDPOINT,
    region: S3_REGION ?? "auto",
    bucket: S3_BUCKET,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  };
}

export function isStorageConfigured(): boolean {
  return getConfig() !== undefined;
}

let cached: { config: Config; client: S3Client } | undefined;

function getStorage() {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "File storage isn't configured: set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
    );
  }
  cached ??= {
    config,
    client: new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Railway Buckets are addressed path-style (endpoint/bucket/key).
      forcePathStyle: true,
    }),
  };
  return cached;
}

/** Saves `body` at `key` (overwriting anything already there) and returns the key. */
export async function uploadFile(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<string> {
  const { client, config } = getStorage();
  await client.send(
    new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentType: contentType }),
  );
  return key;
}

/**
 * A temporary link to download the file - the bucket is private, so files
 * are only ever handed out this way. Expires after `expiresInSeconds` (default 5 minutes).
 */
export async function getFileUrl(key: string, expiresInSeconds = 300): Promise<string> {
  const { client, config } = getStorage();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

export async function deleteFile(key: string): Promise<void> {
  const { client, config } = getStorage();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
