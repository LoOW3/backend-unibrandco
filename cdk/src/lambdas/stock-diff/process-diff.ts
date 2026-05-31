import { S3Client } from '@aws-sdk/client-s3';

import { STOCK_DIFF_RECORD_TYPE } from '../../shared/stock-changes.types';
import { compareStockSnapshots } from './compare-stock';
import {
  findPreviousSnapshotKey,
  listSnapshotKeys,
  loadSnapshots,
} from './load-snapshots';
import { parseSyncedAtFromKey } from './parse-sync-key';
import { saveStockDiff } from './save-changes';
import type { StockDiffEnv, StockDiffResult } from './types';

/**
 * Compares the current snapshot with the previous one and saves changes to DynamoDB.
 */
export async function processStockDiff(
  env: StockDiffEnv,
  currentSyncKey: string,
): Promise<StockDiffResult> {
  const s3Client = new S3Client({});
  const sortedKeys = await listSnapshotKeys(
    s3Client,
    env.STOCK_BUCKET_NAME,
    currentSyncKey,
  );
  const previousSyncKey = findPreviousSnapshotKey(sortedKeys, currentSyncKey);

  if (!previousSyncKey) {
    return {
      skipped: true,
      reason: 'No previous snapshot available',
      currentSyncKey,
    };
  }

  const { currentItems, previousItems } = await loadSnapshots(
    env.STOCK_BUCKET_NAME,
    currentSyncKey,
    previousSyncKey,
  );

  const changedItems = compareStockSnapshots(currentItems, previousItems);
  const syncedAt = parseSyncedAtFromKey(currentSyncKey);
  const createdAt = new Date().toISOString();

  await saveStockDiff(env.STOCK_CHANGES_TABLE_NAME, {
    pk: `SYNC#${currentSyncKey}`,
    recordType: STOCK_DIFF_RECORD_TYPE,
    syncedAt,
    currentSyncKey,
    previousSyncKey,
    changedItems,
    changedCount: changedItems.length,
    createdAt,
  });

  return {
    skipped: false,
    currentSyncKey,
    previousSyncKey,
    changedCount: changedItems.length,
  };
}
