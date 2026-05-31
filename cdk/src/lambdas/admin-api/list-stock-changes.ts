import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { STOCK_DIFF_RECORD_TYPE } from '../../shared/stock-changes.types';
import { decodeCursor, encodeCursor, parseLimit } from './pagination';
import type {
  AdminApiEnv,
  PaginatedStockChangesResponse,
  StockChangeSummary,
} from './types';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function toSummary(item: Record<string, unknown>): StockChangeSummary {
  const tiendanubeSyncRaw = item.tiendanubeSync as Record<string, unknown> | undefined;

  return {
    pk: String(item.pk),
    syncedAt: String(item.syncedAt),
    currentSyncKey: String(item.currentSyncKey),
    previousSyncKey: String(item.previousSyncKey),
    changedCount: Number(item.changedCount),
    createdAt: String(item.createdAt),
    tiendanubeSync: tiendanubeSyncRaw
      ? {
          patchedAt: String(tiendanubeSyncRaw.patchedAt),
          patchedCount: Number(tiendanubeSyncRaw.patchedCount),
          matchedCount: Number(tiendanubeSyncRaw.matchedCount),
          skippedDeleted: Number(tiendanubeSyncRaw.skippedDeleted),
          skippedNoSku: Number(tiendanubeSyncRaw.skippedNoSku),
        }
      : undefined,
  };
}

/**
 * Lists stock change records with pagination, excluding heavy changedItems arrays.
 */
export async function listStockChanges(
  env: AdminApiEnv,
  queryParams: Record<string, string | undefined>,
): Promise<PaginatedStockChangesResponse> {
  const limit = parseLimit(queryParams.limit);
  const exclusiveStartKey = decodeCursor(queryParams.cursor);

  const response = await documentClient.send(
    new QueryCommand({
      TableName: env.STOCK_CHANGES_TABLE_NAME,
      IndexName: env.GSI_NAME,
      KeyConditionExpression: 'recordType = :recordType',
      ExpressionAttributeValues: {
        ':recordType': STOCK_DIFF_RECORD_TYPE,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ProjectionExpression:
        'pk, syncedAt, currentSyncKey, previousSyncKey, changedCount, createdAt, tiendanubeSync',
    }),
  );

  const items = (response.Items ?? []).map((item) =>
    toSummary(item as Record<string, unknown>),
  );

  return {
    items,
    nextCursor: encodeCursor(
      response.LastEvaluatedKey as Record<string, unknown> | undefined,
    ),
  };
}
