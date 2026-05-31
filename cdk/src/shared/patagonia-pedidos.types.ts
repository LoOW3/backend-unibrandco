import type { PatagoniaCreatePedido } from './patagonia-pedido.types';
import type { PatagoniaPedidoStatus } from './resolve-patagonia-pedido-status';
import type { OrderProductsSummary } from './tiendanube.types';

export type { PatagoniaPedidoStatus } from './resolve-patagonia-pedido-status';

/** DynamoDB GSI partition value for Patagonia pedido records. */
export const PATAGONIA_PEDIDO_RECORD_TYPE = 'patagonia-pedido' as const;

/** Tiendanube fulfillment status after Digip Pedido_Completo processing. */
export type PatagoniaPedidoFulfillmentStatus = 'DISPATCHED';

/** Full Patagonia pedido record stored after successful DigipWMS create. */
export interface PatagoniaPedidoRecord {
  pk: string;
  recordType: typeof PATAGONIA_PEDIDO_RECORD_TYPE;
  createdAt: string;
  codigo: string;
  tiendanubeOrderId: number;
  itemCount: number;
  summary: OrderProductsSummary;
  createPedido: PatagoniaCreatePedido;
  fulfillmentStatus?: PatagoniaPedidoFulfillmentStatus;
  shippedAt?: string;
  tiendanubeFulfillmentIds?: string[];
  digipCompletoAt?: string;
}

/** Slim list item for admin API pagination. */
export interface PatagoniaPedidoListItem {
  codigo: string;
  tiendanubeOrderId: number;
  createdAt: string;
  itemCount: number;
  status: PatagoniaPedidoStatus;
  fulfillmentStatus?: PatagoniaPedidoFulfillmentStatus;
  shippedAt?: string;
}

/** GET /admin/patagonia-pedidos/{codigo} response (status is derived, not stored). */
export type PatagoniaPedidoRecordResponse = PatagoniaPedidoRecord & {
  status: PatagoniaPedidoStatus;
};

/**
 * Builds the DynamoDB partition key for a Patagonia pedido record.
 */
export function buildPatagoniaPedidoPk(codigo: string): string {
  return codigo.startsWith('PEDIDO#') ? codigo : `PEDIDO#${codigo}`;
}
