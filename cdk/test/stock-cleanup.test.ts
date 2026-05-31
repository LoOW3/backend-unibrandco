import { findExpiredSnapshotKeys } from '../src/lambdas/stock-cleanup/delete-old-snapshots';
import {
  buildRetentionCutoffDate,
  getUtcDateFromSyncKey,
} from '../src/lambdas/stock-diff/parse-sync-key';

describe('buildRetentionCutoffDate', () => {
  it('keeps the last 8 UTC calendar days inclusive of today', () => {
    const now = new Date('2026-03-09T15:00:00.000Z');
    const cutoff = buildRetentionCutoffDate(now, 8);

    expect(cutoff.toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });
});

describe('getUtcDateFromSyncKey', () => {
  it('parses the UTC day from a snapshot key', () => {
    const date = getUtcDateFromSyncKey('2026/03/02/153000.json');

    expect(date?.toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });

  it('returns undefined for non-snapshot keys', () => {
    expect(getUtcDateFromSyncKey('tienda-nube-products/products-clean.json')).toBeUndefined();
  });
});

describe('findExpiredSnapshotKeys', () => {
  const cutoff = new Date('2026-03-03T00:00:00.000Z');

  it('returns snapshot keys older than the cutoff', () => {
    const keys = [
      '2026/03/02/153000.json',
      '2026/03/03/090000.json',
      '2026/03/09/120000.json',
    ];

    expect(findExpiredSnapshotKeys(keys, cutoff)).toEqual(['2026/03/02/153000.json']);
  });

  it('ignores non-snapshot keys', () => {
    const keys = [
      'tienda-nube-products/products-clean.json',
      '2026/03/01/153000.json',
    ];

    expect(findExpiredSnapshotKeys(keys, cutoff)).toEqual(['2026/03/01/153000.json']);
  });
});
