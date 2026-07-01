import type { StockChangeItem } from './patagonia-stock.types';

export const STOCK_DIFF_RECORD_TYPE = 'STOCK_DIFF';
export const TIENDANUBE_LATEST_META_PK = 'META#TIENDANUBE_LATEST';

/** Single item patched to Tiendanube during a stock sync. */
export interface TiendanubePatchedItem {
  sku: string;
  newStock: number;
  previousStock?: number;
}

/** Tiendanube sync result persisted on a stock diff record. */
export interface TiendanubeSyncResult {
  patchedAt: string;
  patchedCount: number;
  patchedItems: TiendanubePatchedItem[];
  matchedCount: number;
  skippedDeleted: number;
  skippedNoSku: number;
}

/** DynamoDB record for a single stock diff comparison. */
export interface StockDiffRecord {
  pk: string;
  recordType: typeof STOCK_DIFF_RECORD_TYPE;
  syncedAt: string;
  currentSyncKey: string;
  previousSyncKey: string;
  changedItems: StockChangeItem[];
  changedCount: number;
  createdAt: string;
  /** Email of the user who triggered the sync; null/absent for scheduled runs. */
  triggeredBy?: string | null;
  tiendanubeSync?: TiendanubeSyncResult;
}

/** Dashboard metadata for the latest Tiendanube sync. */
export interface TiendanubeLatestMetaRecord {
  pk: typeof TIENDANUBE_LATEST_META_PK;
  syncKey: string;
  syncedAt: string;
  patchedAt: string;
  patchedCount: number;
  patchedItems: TiendanubePatchedItem[];
  /** Email of the user who triggered the sync; null/absent for scheduled runs. */
  triggeredBy?: string | null;
}
