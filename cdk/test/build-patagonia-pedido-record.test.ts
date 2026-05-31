import { buildPatagoniaPedidoRecord } from '../src/lambdas/patagonia-create-pedido/build-patagonia-pedido-record';
import { mapSummaryToCreatePedido } from '../src/shared/map-summary-to-create-pedido';
import {
  buildPatagoniaPedidoPk,
  PATAGONIA_PEDIDO_RECORD_TYPE,
} from '../src/shared/patagonia-pedidos.types';
import type { OrderProductsSummary } from '../src/shared/tiendanube.types';

describe('buildPatagoniaPedidoRecord', () => {
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
      address: 'fernando, zuviria 991',
    },
  };

  it('builds a DynamoDB item with expected shape', () => {
    const createPedido = mapSummaryToCreatePedido(summary, '8436326823');
    const createdAt = new Date('2026-05-31T12:00:00.000Z');
    const record = buildPatagoniaPedidoRecord(summary, createPedido, createdAt);

    expect(record).toEqual({
      pk: 'PEDIDO#1983713089TN',
      recordType: PATAGONIA_PEDIDO_RECORD_TYPE,
      createdAt: '2026-05-31T12:00:00.000Z',
      codigo: '1983713089TN',
      tiendanubeOrderId: 1983713089,
      itemCount: 1,
      summary,
      createPedido,
    });
    expect(record.pk).toBe(buildPatagoniaPedidoPk(createPedido.codigo));
  });
});
