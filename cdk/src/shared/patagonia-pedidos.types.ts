import type { PatagoniaCreatePedido } from './patagonia-pedido.types';
import type { OrderProductsSummary } from './tiendanube.types';

/** DynamoDB GSI partition value for Patagonia pedido records. */
export const PATAGONIA_PEDIDO_RECORD_TYPE = 'patagonia-pedido' as const;

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
}

/** Slim list item for admin API pagination. */
export interface PatagoniaPedidoListItem {
  codigo: string;
  tiendanubeOrderId: number;
  createdAt: string;
  itemCount: number;
}

/**
 * Builds the DynamoDB partition key for a Patagonia pedido record.
 */
export function buildPatagoniaPedidoPk(codigo: string): string {
  return codigo.startsWith('PEDIDO#') ? codigo : `PEDIDO#${codigo}`;
}
