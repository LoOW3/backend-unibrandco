import { findPreviousSnapshotKey } from '../src/lambdas/stock-diff/load-snapshots';
import {
  buildSnapshotDayPrefixes,
  getDayPrefixFromSyncKey,
  parseSyncedAtFromKey,
} from '../src/lambdas/stock-diff/parse-sync-key';

describe('getDayPrefixFromSyncKey', () => {
  it('returns yyyy/mm/dd/ prefix from snapshot key', () => {
    expect(getDayPrefixFromSyncKey('2025/05/30/153000.json')).toBe('2025/05/30/');
  });

  it('returns undefined for invalid keys', () => {
    expect(getDayPrefixFromSyncKey('invalid-key.json')).toBeUndefined();
  });
});

describe('buildSnapshotDayPrefixes', () => {
  it('returns previous and current day prefixes', () => {
    expect(buildSnapshotDayPrefixes('2025/05/30/153000.json')).toEqual([
      '2025/05/29/',
      '2025/05/30/',
    ]);
  });

  it('handles month rollover', () => {
    expect(buildSnapshotDayPrefixes('2025/06/01/003000.json')).toEqual([
      '2025/05/31/',
      '2025/06/01/',
    ]);
  });
});

describe('findPreviousSnapshotKey', () => {
  it('returns the key immediately before the current snapshot', () => {
    const keys = [
      '2025/05/30/150000.json',
      '2025/05/30/151200.json',
      '2025/05/30/153000.json',
    ];

    expect(findPreviousSnapshotKey(keys, '2025/05/30/153000.json')).toBe(
      '2025/05/30/151200.json',
    );
  });

  it('returns undefined when there is no previous snapshot', () => {
    const keys = ['2025/05/30/150000.json'];

    expect(findPreviousSnapshotKey(keys, '2025/05/30/150000.json')).toBeUndefined();
  });

  it('returns last sorted key when current key is not listed yet', () => {
    const keys = ['2025/05/30/150000.json', '2025/05/30/151200.json'];

    expect(findPreviousSnapshotKey(keys, '2025/05/30/153000.json')).toBe(
      '2025/05/30/151200.json',
    );
  });

  it('resolves previous snapshot across day boundary', () => {
    const keys = ['2025/05/29/233000.json', '2025/05/30/003000.json'];

    expect(findPreviousSnapshotKey(keys, '2025/05/30/003000.json')).toBe(
      '2025/05/29/233000.json',
    );
  });
});

describe('parseSyncedAtFromKey', () => {
  it('parses sync key into UTC ISO timestamp', () => {
    expect(parseSyncedAtFromKey('2025/05/30/153000.json')).toBe(
      '2025-05-30T15:30:00.000Z',
    );
  });
});
