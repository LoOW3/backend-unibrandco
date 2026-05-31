import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

import type { StockDiffRecord } from '../../shared/stock-changes.types';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Persists a stock diff record to DynamoDB.
 */
export async function saveStockDiff(
  tableName: string,
  record: StockDiffRecord,
): Promise<void> {
  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: record,
    }),
  );
}
