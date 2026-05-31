/** Environment variables required by the stock cleanup Lambda. */
export interface StockCleanupEnv {
  STOCK_BUCKET_NAME: string;
  RETENTION_DAYS: number;
}

/** Result of deleting old Patagonia stock snapshots from S3. */
export interface StockCleanupResult {
  deletedCount: number;
  cutoffDate: string;
  retentionDays: number;
}
