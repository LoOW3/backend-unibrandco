/** Environment variables required by the admin API Lambda. */
export interface AdminApiEnv {
  STOCK_CHANGES_TABLE_NAME: string;
  STOCK_BUCKET_NAME: string;
  GSI_NAME: string;
  PATAGONIA_PEDIDOS_TABLE_NAME: string;
  PATAGONIA_PEDIDOS_GSI_NAME: string;
  MANUAL_SYNC_STATE_MACHINE_ARN: string;
  USER_POOL_ID: string;
  DB_HOST: string;
  DB_PORT: string;
  DB_USER: string;
  DB_PASS: string;
  DB_NAME: string;
}

/** Response returned when a manual sync run is triggered. */
export interface TriggerManualSyncResponse {
  runId: string;
  executionArn: string;
}

/** Summary of a manual sync run (from its manifest) for the runs list. */
export interface ManualSyncRunSummary {
  runId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  progress: number;
  currentStep: string | null;
  triggeredBy: string | null;
  dryRun: boolean;
  counts: Record<string, number | undefined>;
  error: string | null;
}

/** Response for listing manual sync runs on a given day. */
export interface ManualSyncRunsResponse {
  date: string;
  runs: ManualSyncRunSummary[];
}

export interface AdminDashboardResponse {
  lastTiendanubeSync: {
    syncKey: string;
    syncedAt: string;
    patchedAt: string;
    patchedCount: number;
    triggeredBy?: string | null;
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
  triggeredBy?: string | null;
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

export type PatagoniaPedidoStatus = 'pending' | 'shipped';

export interface PatagoniaPedidoListItem {
  codigo: string;
  tiendanubeOrderId: number;
  createdAt: string;
  itemCount: number;
  status: PatagoniaPedidoStatus;
  fulfillmentStatus?: 'PACKED' | 'DISPATCHED';
  shippedAt?: string;
}

export interface PaginatedPatagoniaPedidosResponse {
  items: PatagoniaPedidoListItem[];
  nextCursor: string | null;
}

export interface ErrorResponse {
  message: string;
}
