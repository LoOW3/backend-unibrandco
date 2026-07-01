import type { StockChangeItem } from '../../shared/patagonia-stock.types';

export interface TiendanubeStockSyncEnv {
  STOCK_BUCKET_NAME: string;
  PRODUCTS_CLEAN_S3_KEY: string;
  TIENDANUBE_API_VERSION: string;
  STOCK_CHANGES_TABLE_NAME: string;
}

export interface ParsedStreamRecord {
  pk: string;
  changedItems: StockChangeItem[];
  triggeredBy?: string | null;
}

export interface BuildStockPatchResult {
  patchItems: import('../../shared/tiendanube.types').TiendanubeStockPatchItem[];
  matchedCount: number;
  skippedDeleted: string[];
  skippedNoSku: string[];
}

export interface TiendanubeStockSyncResult {
  pk?: string;
  skipped?: boolean;
  reason?: string;
  changedCount?: number;
  matchedCount?: number;
  skippedDeleted?: number;
  skippedNoSku?: number;
  patchedCount?: number;
}
