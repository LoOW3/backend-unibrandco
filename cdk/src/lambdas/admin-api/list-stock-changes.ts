import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { STOCK_DIFF_RECORD_TYPE } from '../../shared/stock-changes.types';
import type {
  AdminApiEnv,
  PaginatedStockChangesResponse,
  StockChangeSummary,
} from './types';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(rawLimit: string | undefined): number {
  if (!rawLimit) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawLimit, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function decodeCursor(rawCursor: string | undefined): Record<string, unknown> | undefined {
  if (!rawCursor) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(rawCursor, 'base64url').toString('utf8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function encodeCursor(lastEvaluatedKey: Record<string, unknown> | undefined): string | null {
  if (!lastEvaluatedKey) {
    return null;
  }

  return Buffer.from(JSON.stringify(lastEvaluatedKey), 'utf8').toString('base64url');
}

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
