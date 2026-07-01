import { ListObjectsV2Command } from '@aws-sdk/client-s3';

import { getS3Client } from './s3-json';

/** Root prefix for all manual-sync runs. */
export const MANUAL_SYNC_ROOT = 'manual-sync/';

/** Matches a run prefix: manual-sync/yyyy/mm/dd/run-N/ */
const RUN_PREFIX_PATTERN =
  /^manual-sync\/(\d{4})\/(\d{2})\/(\d{2})\/run-(\d+)\/$/;

/** Builds the day prefix manual-sync/yyyy/mm/dd/ for a UTC date. */
export function buildManualSyncDayPrefix(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${MANUAL_SYNC_ROOT}${year}/${month}/${day}/`;
}

/** Converts a YYYY-MM-DD string into the day prefix manual-sync/yyyy/mm/dd/. */
export function buildManualSyncDayPrefixFromDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${MANUAL_SYNC_ROOT}${year}/${month}/${day}/`;
}

/** True when the key is a run prefix (with trailing slash). */
export function isRunPrefix(prefix: string): boolean {
  return RUN_PREFIX_PATTERN.test(prefix);
}

/** Extracts the run number N from a run prefix, or undefined. */
export function getRunNumber(prefix: string): number | undefined {
  const match = prefix.match(RUN_PREFIX_PATTERN);
  return match ? Number(match[4]) : undefined;
}

/**
 * Lists existing run-N prefixes for a given day and returns the next run prefix.
 * Uses Delimiter to list only the immediate run folders (CommonPrefixes).
 */
export async function resolveNextRunPrefix(
  bucket: string,
  date: Date,
): Promise<string> {
  const dayPrefix = buildManualSyncDayPrefix(date);
  const response = await getS3Client().send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: dayPrefix,
      Delimiter: '/',
    }),
  );

  let maxRun = 0;
  for (const entry of response.CommonPrefixes ?? []) {
    const runNumber = entry.Prefix ? getRunNumber(entry.Prefix) : undefined;
    if (runNumber && runNumber > maxRun) {
      maxRun = runNumber;
    }
  }

  return `${dayPrefix}run-${maxRun + 1}/`;
}
