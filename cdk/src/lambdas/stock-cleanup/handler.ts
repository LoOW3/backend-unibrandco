import type { Context, ScheduledEvent } from 'aws-lambda';

import { deleteOldSnapshots } from './delete-old-snapshots';
import type { StockCleanupEnv, StockCleanupResult } from './types';

function getEnv(): StockCleanupEnv {
  const bucketName = process.env.STOCK_BUCKET_NAME;
  const retentionDaysRaw = process.env.RETENTION_DAYS;

  if (!bucketName || !retentionDaysRaw) {
    throw new Error('Missing required environment variables for stock cleanup');
  }

  const retentionDays = Number.parseInt(retentionDaysRaw, 10);

  if (Number.isNaN(retentionDays) || retentionDays < 1) {
    throw new Error('RETENTION_DAYS must be a positive integer');
  }

  return {
    STOCK_BUCKET_NAME: bucketName,
    RETENTION_DAYS: retentionDays,
  };
}

/**
 * Lambda handler for scheduled cleanup of old Patagonia stock snapshots in S3.
 */
export async function handler(
  _event: ScheduledEvent,
  _context: Context,
): Promise<StockCleanupResult> {
  const result = await deleteOldSnapshots(getEnv());

  console.log(JSON.stringify({ action: 'stock snapshot cleanup completed', ...result }));

  return result;
}
