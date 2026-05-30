import type { StockChangeItem } from '../../shared/patagonia-stock.types';

/** Environment variables required by the stock diff Lambda. */
export interface StockDiffEnv {
  STOCK_BUCKET_NAME: string;
  STOCK_CHANGES_TABLE_NAME: string;
}

/** DynamoDB record for a single stock diff comparison. */
export interface StockDiffRecord {
  pk: string;
  syncedAt: string;
  currentSyncKey: string;
  previousSyncKey: string;
  changedItems: StockChangeItem[];
  changedCount: number;
  createdAt: string;
}

/** Result of processing a stock diff. */
export interface StockDiffResult {
  skipped: boolean;
  reason?: string;
  currentSyncKey?: string;
  previousSyncKey?: string;
  changedCount?: number;
}
