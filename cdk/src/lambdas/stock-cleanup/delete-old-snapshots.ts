import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  buildRetentionCutoffDate,
  getUtcDateFromSyncKey,
  isStockSnapshotKey,
} from '../stock-diff/parse-sync-key';
import type { StockCleanupEnv, StockCleanupResult } from './types';

const DELETE_BATCH_SIZE = 1000;

/**
 * Returns snapshot keys that are older than the retention cutoff.
 */
export function findExpiredSnapshotKeys(
  keys: string[],
  cutoffDate: Date,
): string[] {
  return keys.filter((key) => {
    if (!isStockSnapshotKey(key)) {
      return false;
    }

    const keyDate = getUtcDateFromSyncKey(key);

    if (!keyDate) {
      return false;
    }

    return keyDate.getTime() < cutoffDate.getTime();
  });
}

async function listAllObjectKeys(
  s3Client: S3Client,
  bucketName: string,
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (object.Key) {
        keys.push(object.Key);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

async function deleteKeysInBatches(
  s3Client: S3Client,
  bucketName: string,
  keys: string[],
): Promise<number> {
  let deletedCount = 0;

  for (let index = 0; index < keys.length; index += DELETE_BATCH_SIZE) {
    const batch = keys.slice(index, index + DELETE_BATCH_SIZE);

    const response = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );

    deletedCount += response.Deleted?.length ?? 0;
  }

  return deletedCount;
}

/**
 * Deletes Patagonia stock snapshots older than the configured retention window.
 */
export async function deleteOldSnapshots(
  env: StockCleanupEnv,
  now: Date = new Date(),
): Promise<StockCleanupResult> {
  const cutoffDate = buildRetentionCutoffDate(now, env.RETENTION_DAYS);
  const s3Client = new S3Client({});
  const allKeys = await listAllObjectKeys(s3Client, env.STOCK_BUCKET_NAME);
  const expiredKeys = findExpiredSnapshotKeys(allKeys, cutoffDate);
  const deletedCount = await deleteKeysInBatches(
    s3Client,
    env.STOCK_BUCKET_NAME,
    expiredKeys,
  );

  return {
    deletedCount,
    cutoffDate: cutoffDate.toISOString(),
    retentionDays: env.RETENTION_DAYS,
  };
}
