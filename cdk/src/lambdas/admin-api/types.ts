/** Environment variables required by the admin API Lambda. */
export interface AdminApiEnv {
  STOCK_CHANGES_TABLE_NAME: string;
  STOCK_BUCKET_NAME: string;
  GSI_NAME: string;
}

export interface AdminDashboardResponse {
  lastTiendanubeSync: {
    syncKey: string;
    syncedAt: string;
    patchedAt: string;
    patchedCount: number;
    patchedItems: Array<{
      sku: string;
      newStock: number;
      previousStock?: number;
    }>;
  } | null;
}

export interface StockChangeSummary {
  pk: string;
  syncedAt: string;
  currentSyncKey: string;
  previousSyncKey: string;
  changedCount: number;
  createdAt: string;
  tiendanubeSync?: {
    patchedAt: string;
    patchedCount: number;
    matchedCount: number;
    skippedDeleted: number;
    skippedNoSku: number;
  };
}

export interface PaginatedStockChangesResponse {
  items: StockChangeSummary[];
  nextCursor: string | null;
}

export interface StockFileEntry {
  s3Key: string;
  syncedAt: string;
  sizeBytes: number;
}

export interface StockFilesResponse {
  date: string;
  files: StockFileEntry[];
}

export interface StockFileDownloadResponse {
  syncKey: string;
  downloadUrl: string;
  expiresAt: string;
  contentType: string;
}

export interface ErrorResponse {
  message: string;
}
