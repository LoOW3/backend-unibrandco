import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import {
  TIENDANUBE_LATEST_META_PK,
  type TiendanubeLatestMetaRecord,
  type TiendanubeSyncResult,
} from '../../shared/stock-changes.types';
import { parseSyncedAtFromKey } from '../stock-diff/parse-sync-key';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Persists Tiendanube sync results on the stock diff record and latest meta item.
 */
export async function saveTiendanubeSync(
  tableName: string,
  pk: string,
  syncKey: string,
  tiendanubeSync: TiendanubeSyncResult,
): Promise<void> {
  await documentClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { pk },
      UpdateExpression: 'SET tiendanubeSync = :tiendanubeSync',
      ExpressionAttributeValues: {
        ':tiendanubeSync': tiendanubeSync,
      },
    }),
  );

  const metaRecord: TiendanubeLatestMetaRecord = {
    pk: TIENDANUBE_LATEST_META_PK,
    syncKey,
    syncedAt: parseSyncedAtFromKey(syncKey),
    patchedAt: tiendanubeSync.patchedAt,
    patchedCount: tiendanubeSync.patchedCount,
    patchedItems: tiendanubeSync.patchedItems,
  };

  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: metaRecord,
    }),
  );
}
