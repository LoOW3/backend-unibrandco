import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { isStockSnapshotKey } from '../stock-diff/parse-sync-key';
import type { AdminApiEnv, StockFileDownloadResponse } from './types';

export const PRESIGNED_URL_TTL_SECONDS = 300;

/** Matches a manual-sync run artifact: manual-sync/yyyy/mm/dd/run-N/<file>.json */
const MANUAL_SYNC_ARTIFACT_PATTERN =
  /^manual-sync\/\d{4}\/\d{2}\/\d{2}\/run-\d+\/[A-Za-z0-9._-]+\.json$/;

/** True when the key is a downloadable stock snapshot or manual-sync artifact. */
export function isDownloadableKey(key: string): boolean {
  return isStockSnapshotKey(key) || MANUAL_SYNC_ARTIFACT_PATTERN.test(key);
}

export class StockFileDownloadError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'StockFileDownloadError';
  }
}

/**
 * Validates that a sync key is a Patagonia stock snapshot path.
 */
export function validateSyncKeyForDownload(syncKey: string | undefined): string {
  if (!syncKey) {
    throw new StockFileDownloadError(400, 'Missing syncKey query parameter');
  }

  const decodedSyncKey = decodeURIComponent(syncKey);

  if (!isDownloadableKey(decodedSyncKey)) {
    throw new StockFileDownloadError(
      400,
      'Invalid syncKey. Expected yyyy/mm/dd/HHmmss.json or manual-sync/yyyy/mm/dd/run-N/<file>.json',
    );
  }

  return decodedSyncKey;
}

/**
 * Generates a presigned S3 URL to download a Patagonia stock snapshot.
 */
export async function getStockFileDownload(
  env: AdminApiEnv,
  syncKey: string | undefined,
): Promise<StockFileDownloadResponse> {
  const decodedSyncKey = validateSyncKeyForDownload(syncKey);
  const s3Client = new S3Client({});

  try {
    const headResponse = await s3Client.send(
      new HeadObjectCommand({
        Bucket: env.STOCK_BUCKET_NAME,
        Key: decodedSyncKey,
      }),
    );

    const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000);
    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: env.STOCK_BUCKET_NAME,
        Key: decodedSyncKey,
      }),
      { expiresIn: PRESIGNED_URL_TTL_SECONDS },
    );

    return {
      syncKey: decodedSyncKey,
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
      contentType: headResponse.ContentType ?? 'application/json',
    };
  } catch (error) {
    if (
      error instanceof NotFound ||
      (error instanceof Error &&
        (error.name === 'NotFound' || error.name === 'NoSuchKey'))
    ) {
      throw new StockFileDownloadError(404, 'Stock snapshot file not found');
    }

    throw error;
  }
}
