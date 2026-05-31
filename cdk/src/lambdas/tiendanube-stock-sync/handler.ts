import type { Context, DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';

import { parseStreamRecord } from './parse-stream-record';
import { processTiendanubeStockSync } from './process-sync';
import type { TiendanubeStockSyncEnv, TiendanubeStockSyncResult } from './types';

function getEnv(): TiendanubeStockSyncEnv {
  const bucketName = process.env.STOCK_BUCKET_NAME;
  const productsCleanKey = process.env.PRODUCTS_CLEAN_S3_KEY;
  const secretArn = process.env.TIENDANUBE_SECRET_ARN;
  const apiVersion = process.env.TIENDANUBE_API_VERSION ?? '2025-03';
  const tableName = process.env.STOCK_CHANGES_TABLE_NAME;

  if (!bucketName || !productsCleanKey || !secretArn || !tableName) {
    throw new Error('Missing required environment variables for Tiendanube stock sync');
  }

  return {
    STOCK_BUCKET_NAME: bucketName,
    PRODUCTS_CLEAN_S3_KEY: productsCleanKey,
    TIENDANUBE_SECRET_ARN: secretArn,
    TIENDANUBE_API_VERSION: apiVersion,
    STOCK_CHANGES_TABLE_NAME: tableName,
  };
}

async function processRecord(
  env: TiendanubeStockSyncEnv,
  record: DynamoDBRecord,
): Promise<TiendanubeStockSyncResult> {
  const parsed = parseStreamRecord(record);

  if (!parsed) {
    return {
      skipped: true,
      reason: `Ignoring non-INSERT or invalid stream record: ${record.eventName ?? 'unknown'}`,
    };
  }

  return processTiendanubeStockSync(env, parsed);
}

/**
 * Lambda handler triggered by DynamoDB stream INSERT events on stock diff records.
 */
export async function handler(
  event: DynamoDBStreamEvent,
  _context: Context,
): Promise<TiendanubeStockSyncResult[]> {
  const env = getEnv();

  return Promise.all(event.Records.map((record) => processRecord(env, record)));
}
