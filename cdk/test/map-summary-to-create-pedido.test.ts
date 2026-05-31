import {
  mapSummaryToCreatePedido,
  MapSummaryToPedidoError,
} from '../src/shared/map-summary-to-create-pedido';
import type { OrderProductsSummary } from '../src/shared/tiendanube.types';

describe('mapSummaryToCreatePedido', () => {
  const summary: OrderProductsSummary = {
    id: 1983713089,
    products: [
      {
        id: 3262803667,
        variant_id: '1339387209',
        quantity: '2',
        sku: 'GL35010',
      },
    ],
    userData: {
      name: 'Fernando Irigoyen',
      phone: '',
      email: 'fernando.nirigoyen@gmail.com',
      address:
        'fernando, zuviria 991, b, parque chacabuco, 1424, caba, Capital Federal, AR',
    },
  };

  it('maps summary to DigipWMS CreatePedido', () => {
    const fecha = new Date('2026-05-31T12:00:00.000Z');
    const result = mapSummaryToCreatePedido(summary, '8436326823', fecha);

    expect(result.codigo).toBe('1983713089TN');
    expect(result.clienteUbicacionCodigo).toBe('8436326823');
    expect(result.fecha).toBe('2026-05-31T12:00:00.000Z');
    expect(result.estado).toBe('Pendiente');
    expect(result.observacion).toContain('Fernando Irigoyen');
    expect(result.observacion).toContain('fernando.nirigoyen@gmail.com');
    expect(result.items).toEqual([
      {
        linea: '3262803667TN',
        articuloCodigo: 'GL35010',
        unidades: 2,
      },
    ]);
  });

  it('assigns distinct linea per product id', () => {
    const result = mapSummaryToCreatePedido(
      {
        ...summary,
        products: [
          { id: 100, variant_id: '1', quantity: '1', sku: 'SKU-A' },
          { id: 200, variant_id: '2', quantity: '3', sku: 'SKU-B' },
        ],
      },
      '8436326823',
    );

    expect(result.items).toEqual([
      { linea: '100TN', articuloCodigo: 'SKU-A', unidades: 1 },
      { linea: '200TN', articuloCodigo: 'SKU-B', unidades: 3 },
    ]);
  });

  it('throws when no items have SKU', () => {
    expect(() =>
      mapSummaryToCreatePedido(
        {
          ...summary,
          products: [{ id: 1, variant_id: '1', quantity: '1', sku: null }],
        },
        '8436326823',
      ),
    ).toThrow(MapSummaryToPedidoError);
  });
});
