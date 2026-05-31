import type { PatagoniaCreatePedido } from '../../shared/patagonia-pedido.types';
import {
  buildPatagoniaPedidoPk,
  PATAGONIA_PEDIDO_RECORD_TYPE,
  type PatagoniaPedidoRecord,
} from '../../shared/patagonia-pedidos.types';
import type { OrderProductsSummary } from '../../shared/tiendanube.types';

/**
 * Builds the DynamoDB item for a Patagonia pedido record (for tests and save).
 */
export function buildPatagoniaPedidoRecord(
  summary: OrderProductsSummary,
  createPedido: PatagoniaCreatePedido,
  createdAt: Date = new Date(),
): PatagoniaPedidoRecord {
  const createdAtIso = createdAt.toISOString();

  return {
    pk: buildPatagoniaPedidoPk(createPedido.codigo),
    recordType: PATAGONIA_PEDIDO_RECORD_TYPE,
    createdAt: createdAtIso,
    codigo: createPedido.codigo,
    tiendanubeOrderId: summary.id,
    itemCount: createPedido.items.length,
    summary,
    createPedido,
  };
}
