import { filterHeadersForLog } from '../src/lambdas/digip-pedido-completo-webhook/filter-headers';

describe('filterHeadersForLog', () => {
  it('excludes authorization and x-api-key', () => {
    const result = filterHeadersForLog({
      'content-type': 'application/json',
      Authorization: 'Bearer secret',
      'X-API-Key': 'key',
    });

    expect(result).toEqual({ 'content-type': 'application/json' });
  });

  it('returns empty object when headers are undefined', () => {
    expect(filterHeadersForLog(undefined)).toEqual({});
  });
});
