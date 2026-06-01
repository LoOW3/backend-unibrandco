import { shipFulfillmentToDispatched } from '../src/lambdas/tiendanube-fulfillment-ship/ship-fulfillment-to-dispatched';
import type { TiendanubeConfig } from '../src/shared/tiendanube.types';

const config: TiendanubeConfig = {
  store_id: '6835321',
  access_token: 'token',
  user_agent: 'Test Agent',
};

describe('shipFulfillmentToDispatched', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns empty when order has no fulfillments', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1, products: [], fulfillments: [] }),
    } as Response);

    const result = await shipFulfillmentToDispatched(config, '2025-03', 1984097529);

    expect(result).toEqual({ patchedIds: [], skippedIds: [] });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('skips fulfillments already PACKED or DISPATCHED', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1984097529,
          products: [],
          fulfillments: ['01KT0378Q9VRBDAK8A8PPNQWFN', '01KT0378Q9VRBDAK8A8PPNQWFO'],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '01KT0378Q9VRBDAK8A8PPNQWFN', status: 'PACKED' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '01KT0378Q9VRBDAK8A8PPNQWFO', status: 'DISPATCHED' }),
      } as Response);

    const result = await shipFulfillmentToDispatched(config, '2025-03', 1984097529);

    expect(result.patchedIds).toEqual([]);
    expect(result.skippedIds).toEqual([
      '01KT0378Q9VRBDAK8A8PPNQWFN',
      '01KT0378Q9VRBDAK8A8PPNQWFO',
    ]);
  });

  it('PATCHes UNPACKED fulfillment to PACKED', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1984097529,
          products: [],
          fulfillments: ['01KT0378Q9VRBDAK8A8PPNQWFN'],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '01KT0378Q9VRBDAK8A8PPNQWFN', status: 'UNPACKED' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '01KT0378Q9VRBDAK8A8PPNQWFN', status: 'PACKED' }),
      } as Response);

    const result = await shipFulfillmentToDispatched(config, '2025-03', 1984097529);

    expect(result.patchedIds).toEqual(['01KT0378Q9VRBDAK8A8PPNQWFN']);
    expect(result.skippedIds).toEqual([]);
  });
});
