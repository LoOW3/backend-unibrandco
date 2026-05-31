import { buildStockChangePk } from '../src/lambdas/admin-api/get-stock-change';
import {
  buildDayPrefixFromDate,
  isValidDateParam,
} from '../src/lambdas/admin-api/list-stock-files';

describe('buildStockChangePk', () => {
  it('prefixes sync key when missing', () => {
    expect(buildStockChangePk('2025/05/30/153000.json')).toBe(
      'SYNC#2025/05/30/153000.json',
    );
  });

  it('keeps pk when already prefixed', () => {
    expect(buildStockChangePk('SYNC#2025/05/30/153000.json')).toBe(
      'SYNC#2025/05/30/153000.json',
    );
  });
});

describe('list stock files date helpers', () => {
  it('builds S3 day prefix from YYYY-MM-DD', () => {
    expect(buildDayPrefixFromDate('2025-05-30')).toBe('2025/05/30/');
  });

  it('validates date query param format', () => {
    expect(isValidDateParam('2025-05-30')).toBe(true);
    expect(isValidDateParam('2025/05/30')).toBe(false);
    expect(isValidDateParam(undefined)).toBe(false);
  });
});
