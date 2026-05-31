import { decodeCursor, encodeCursor, parseLimit } from '../src/lambdas/admin-api/pagination';

describe('parseLimit', () => {
  it('defaults to 20 when missing or invalid', () => {
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit('abc')).toBe(20);
    expect(parseLimit('0')).toBe(20);
  });

  it('caps at 100', () => {
    expect(parseLimit('200')).toBe(100);
    expect(parseLimit('50')).toBe(50);
  });
});

describe('cursor encode/decode', () => {
  const key = { pk: 'PEDIDO#1983713089TN', recordType: 'patagonia-pedido' };

  it('round-trips a LastEvaluatedKey', () => {
    const cursor = encodeCursor(key);
    expect(cursor).not.toBeNull();
    expect(decodeCursor(cursor!)).toEqual(key);
  });

  it('returns undefined for invalid cursor', () => {
    expect(decodeCursor('not-valid-base64!!!')).toBeUndefined();
  });

  it('encodeCursor returns null when key is undefined', () => {
    expect(encodeCursor(undefined)).toBeNull();
  });
});
