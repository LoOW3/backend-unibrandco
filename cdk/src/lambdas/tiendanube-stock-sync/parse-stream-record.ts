import type { DynamoDBRecord } from 'aws-lambda';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import type { StockChangeItem } from '../../shared/patagonia-stock.types';

import type { ParsedStreamRecord } from './types';

/**
 * Extracts changedItems from a DynamoDB stream INSERT record.
 */
export function parseStreamRecord(
  record: DynamoDBRecord,
): ParsedStreamRecord | undefined {
  if (record.eventName !== 'INSERT') {
    return undefined;
  }

  const newImage = record.dynamodb?.NewImage;
  if (!newImage) {
    return undefined;
  }

  const item = unmarshall(newImage as Record<string, AttributeValue>) as {
    pk?: string;
    changedItems?: StockChangeItem[];
    triggeredBy?: string | null;
  };

  if (!item.pk || !Array.isArray(item.changedItems)) {
    return undefined;
  }

  return {
    pk: item.pk,
    changedItems: item.changedItems,
    triggeredBy: item.triggeredBy ?? null,
  };
}
