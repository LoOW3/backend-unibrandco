import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

import { TIENDANUBE_LATEST_META_PK } from '../../shared/stock-changes.types';
import type { AdminApiEnv, AdminDashboardResponse } from './types';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Returns dashboard data for the latest Tiendanube stock sync.
 */
export async function getDashboard(
  env: AdminApiEnv,
): Promise<AdminDashboardResponse> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: env.STOCK_CHANGES_TABLE_NAME,
      Key: { pk: TIENDANUBE_LATEST_META_PK },
    }),
  );

  if (!response.Item) {
    return { lastTiendanubeSync: null };
  }

  const item = response.Item;

  return {
    lastTiendanubeSync: {
      syncKey: String(item.syncKey),
      syncedAt: String(item.syncedAt),
      patchedAt: String(item.patchedAt),
      patchedCount: Number(item.patchedCount),
      triggeredBy: typeof item.triggeredBy === 'string' ? item.triggeredBy : null,
      patchedItems: Array.isArray(item.patchedItems)
        ? item.patchedItems.map((patchedItem: Record<string, unknown>) => ({
            sku: String(patchedItem.sku),
            newStock: Number(patchedItem.newStock),
            previousStock:
              patchedItem.previousStock === undefined
                ? undefined
                : Number(patchedItem.previousStock),
          }))
        : [],
    },
  };
}
