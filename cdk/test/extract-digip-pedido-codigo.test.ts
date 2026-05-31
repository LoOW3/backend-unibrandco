import { extractDigipPedidoCodigo } from '../src/shared/extract-digip-pedido-codigo';

describe('extractDigipPedidoCodigo', () => {
  it('extracts Codigo from pedido completo body', () => {
    const codigo = extractDigipPedidoCodigo({
      event: 'pedido_completo',
      data: { Codigo: '1984097529TN', Estado: 'Completo' },
    });

    expect(codigo).toBe('1984097529TN');
  });

  it('returns null when data is missing', () => {
    expect(extractDigipPedidoCodigo({ event: 'other' })).toBeNull();
    expect(extractDigipPedidoCodigo('raw')).toBeNull();
  });
});
