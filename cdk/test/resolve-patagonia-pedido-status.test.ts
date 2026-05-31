import { resolvePatagoniaPedidoStatus } from '../src/shared/resolve-patagonia-pedido-status';

describe('resolvePatagoniaPedidoStatus', () => {
  it('returns pending when fulfillmentStatus is missing', () => {
    expect(resolvePatagoniaPedidoStatus({})).toBe('pending');
  });

  it('returns shipped when fulfillmentStatus is DISPATCHED', () => {
    expect(
      resolvePatagoniaPedidoStatus({ fulfillmentStatus: 'DISPATCHED' }),
    ).toBe('shipped');
  });

  it('returns pending for other fulfillmentStatus values', () => {
    expect(
      resolvePatagoniaPedidoStatus({ fulfillmentStatus: 'PACKED' }),
    ).toBe('pending');
  });
});
