import type { StockChangeItem } from '../../shared/patagonia-stock.types';
import type { StockDiffRecord } from '../../shared/stock-changes.types';

export type { StockDiffRecord } from '../../shared/stock-changes.types';

/** Environment variables required by the stock diff Lambda. */
export interface StockDiffEnv {
  STOCK_BUCKET_NAME: string;
  STOCK_CHANGES_TABLE_NAME: string;
}

/** Result of processing a stock diff. */
export interface StockDiffResult {
  skipped: boolean;
  reason?: string;
  currentSyncKey?: string;
  previousSyncKey?: string;
  changedCount?: number;
}

export type { StockChangeItem };
