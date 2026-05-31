import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

import { isStockSnapshotKey, parseSyncedAtFromKey } from '../stock-diff/parse-sync-key';
import type { AdminApiEnv, StockFilesResponse } from './types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts YYYY-MM-DD into an S3 day prefix yyyy/mm/dd/.
 */
export function buildDayPrefixFromDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}/${month}/${day}/`;
}

/**
 * Validates a date query parameter in YYYY-MM-DD format.
 */
export function isValidDateParam(date: string | undefined): date is string {
  return Boolean(date && DATE_PATTERN.test(date));
}

/**
 * Lists Patagonia stock snapshot files for a given day.
 */
export async function listStockFiles(
  env: AdminApiEnv,
  date: string,
): Promise<StockFilesResponse> {
  const prefix = buildDayPrefixFromDate(date);
  const s3Client = new S3Client({});
  const files: StockFilesResponse['files'] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: env.STOCK_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (!object.Key || !isStockSnapshotKey(object.Key)) {
        continue;
      }

      files.push({
        s3Key: object.Key,
        syncedAt: parseSyncedAtFromKey(object.Key),
        sizeBytes: object.Size ?? 0,
      });
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  files.sort((left, right) => right.syncedAt.localeCompare(left.syncedAt));

  return {
    date,
    files,
  };
}
