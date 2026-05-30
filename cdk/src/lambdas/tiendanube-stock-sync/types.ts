import type { StockChangeItem } from '../../shared/patagonia-stock.types';

export interface TiendanubeStockSyncEnv {
  STOCK_BUCKET_NAME: string;
  PRODUCTS_CLEAN_S3_KEY: string;
  TIENDANUBE_SECRET_ARN: string;
  TIENDANUBE_API_VERSION: string;
}

export interface ParsedStreamRecord {
  pk: string;
  changedItems: StockChangeItem[];
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
