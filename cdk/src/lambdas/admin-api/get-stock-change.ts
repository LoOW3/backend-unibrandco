import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

import type { StockDiffRecord } from '../../shared/stock-changes.types';
import type { AdminApiEnv } from './types';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Builds the DynamoDB pk for a stock change record.
 */
export function buildStockChangePk(syncKey: string): string {
  return syncKey.startsWith('SYNC#') ? syncKey : `SYNC#${syncKey}`;
}

/**
 * Returns a full stock change record by sync key.
 */
export async function getStockChange(
  env: AdminApiEnv,
  syncKey: string,
): Promise<StockDiffRecord | null> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: env.STOCK_CHANGES_TABLE_NAME,
      Key: { pk: buildStockChangePk(syncKey) },
    }),
  );

  if (!response.Item) {
    return null;
  }

  return response.Item as StockDiffRecord;
}
