import { buildPatagoniaPedidoPk } from '../src/shared/patagonia-pedidos.types';

describe('buildPatagoniaPedidoPk', () => {
  it('prefixes codigo when missing', () => {
    expect(buildPatagoniaPedidoPk('1983713089TN')).toBe('PEDIDO#1983713089TN');
  });

  it('keeps pk when already prefixed', () => {
    expect(buildPatagoniaPedidoPk('PEDIDO#1983713089TN')).toBe('PEDIDO#1983713089TN');
  });
});
