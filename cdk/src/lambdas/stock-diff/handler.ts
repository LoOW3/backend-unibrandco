import type { Context, S3Event, S3EventRecord } from 'aws-lambda';

import { isStockSnapshotKey } from './parse-sync-key';
import { processStockDiff } from './process-diff';
import type { StockDiffEnv, StockDiffResult } from './types';

function getEnv(): StockDiffEnv {
  const bucketName = process.env.STOCK_BUCKET_NAME;
  const tableName = process.env.STOCK_CHANGES_TABLE_NAME;

  if (!bucketName || !tableName) {
    throw new Error('Missing required environment variables for stock diff');
  }

  return {
    STOCK_BUCKET_NAME: bucketName,
    STOCK_CHANGES_TABLE_NAME: tableName,
  };
}

async function processRecord(
  env: StockDiffEnv,
  record: S3EventRecord,
): Promise<StockDiffResult> {
  const bucketName = record.s3.bucket.name;
  const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  if (bucketName !== env.STOCK_BUCKET_NAME) {
    return {
      skipped: true,
      reason: `Ignoring object from unexpected bucket: ${bucketName}`,
    };
  }

  if (!isStockSnapshotKey(objectKey)) {
    return {
      skipped: true,
      reason: `Ignoring non-snapshot object: ${objectKey}`,
    };
  }

  return processStockDiff(env, objectKey);
}

/**
 * Lambda handler triggered by S3 ObjectCreated events on stock snapshots.
 */
export async function handler(
  event: S3Event,
  _context: Context,
): Promise<StockDiffResult[]> {
  const env = getEnv();

  return Promise.all(event.Records.map((record) => processRecord(env, record)));
}
