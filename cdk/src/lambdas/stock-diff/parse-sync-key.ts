const SYNC_KEY_PATTERN =
  /^(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})(\d{2})(\d{2})\.json$/;

function formatDayPrefix(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}/${month}/${day}/`;
}

/**
 * Returns "yyyy/mm/dd/" from a snapshot key, or undefined if invalid.
 */
export function getDayPrefixFromSyncKey(key: string): string | undefined {
  const match = key.match(SYNC_KEY_PATTERN);

  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  return `${year}/${month}/${day}/`;
}

/**
 * Returns the UTC calendar date (midnight) parsed from a snapshot key.
 */
export function getUtcDateFromSyncKey(key: string): Date | undefined {
  const match = key.match(SYNC_KEY_PATTERN);

  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/**
 * Returns the UTC cutoff date for snapshot retention (inclusive window start).
 */
export function buildRetentionCutoffDate(
  now: Date,
  retentionDays: number,
): Date {
  const todayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const cutoff = new Date(todayStart);
  cutoff.setUTCDate(cutoff.getUTCDate() - (retentionDays - 1));

  return cutoff;
}

/**
 * Returns [previousDayPrefix, currentDayPrefix] in UTC.
 */
export function buildSnapshotDayPrefixes(currentSyncKey: string): string[] {
  const currentDayPrefix = getDayPrefixFromSyncKey(currentSyncKey);

  if (!currentDayPrefix) {
    throw new Error(`Invalid snapshot key: ${currentSyncKey}`);
  }

  const match = currentSyncKey.match(SYNC_KEY_PATTERN);

  if (!match) {
    throw new Error(`Invalid snapshot key: ${currentSyncKey}`);
  }

  const [, year, month, day] = match;
  const currentDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  const previousDate = new Date(currentDate);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);

  return [formatDayPrefix(previousDate), currentDayPrefix];
}

/**
 * Parses an S3 sync key (yyyy/mm/dd/HHmmss.json) into an ISO UTC timestamp.
 */
export function parseSyncedAtFromKey(key: string): string {
  const match = key.match(SYNC_KEY_PATTERN);

  if (!match) {
    return new Date().toISOString();
  }

  const [, year, month, day, hours, minutes, seconds] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    ),
  ).toISOString();
}

/**
 * Returns true when the S3 key matches a stock snapshot file.
 */
export function isStockSnapshotKey(key: string): boolean {
  return SYNC_KEY_PATTERN.test(key);
}
