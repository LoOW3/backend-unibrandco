/** Returns the shared stock S3 bucket name. */
export function getBucketName(): string {
  const bucket = process.env.STOCK_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Missing STOCK_BUCKET_NAME environment variable');
  }
  return bucket;
}

/** Returns the Tiendanube API version (defaults to 2025-03). */
export function getApiVersion(): string {
  return process.env.TIENDANUBE_API_VERSION ?? '2025-03';
}

/** Returns the Patagonia WMS stock endpoint URL. */
export function getPatagoniaApiUrl(): string {
  const url = process.env.PATAGONIA_API_URL;
  if (!url) {
    throw new Error('Missing PATAGONIA_API_URL environment variable');
  }
  return url;
}

/** Number of PATCH chunks processed per send-patch Lambda invocation. */
export function getSendBatchChunks(): number {
  const raw = process.env.SEND_BATCH_CHUNKS;
  const parsed = raw ? Number(raw) : 20;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}
