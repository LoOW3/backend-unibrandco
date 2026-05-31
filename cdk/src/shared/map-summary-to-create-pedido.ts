import { formatOrderObservacion } from './format-order-observacion';
import type { PatagoniaCreatePedido, PatagoniaCreatePedidoItem } from './patagonia-pedido.types';
import type { OrderProductsSummary } from './tiendanube.types';

export class MapSummaryToPedidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapSummaryToPedidoError';
  }
}

/**
 * Builds DigipWMS linea from Tiendanube order line id (same TN suffix as pedido codigo).
 */
export function buildTiendanubeLinea(productId: number): string {
  return `${productId}TN`;
}

function parseUnidades(quantity: string | number): number | undefined {
  const parsed = Number.parseInt(String(quantity), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

function buildItems(products: OrderProductsSummary['products']): PatagoniaCreatePedidoItem[] {
  const items: PatagoniaCreatePedidoItem[] = [];

  for (const product of products) {
    const sku = product.sku?.trim();

    if (!sku) {
      continue;
    }

    const unidades = parseUnidades(product.quantity);

    if (unidades === undefined) {
      throw new MapSummaryToPedidoError(
        `Invalid quantity for SKU ${sku}: ${String(product.quantity)}`,
      );
    }

    items.push({
      linea: buildTiendanubeLinea(product.id),
      articuloCodigo: sku,
      unidades,
    });
  }

  if (items.length === 0) {
    throw new MapSummaryToPedidoError('No order line items with a valid SKU and quantity');
  }

  return items;
}

/**
 * Maps a Tiendanube order summary to DigipWMS CreatePedido payload.
 */
export function mapSummaryToCreatePedido(
  summary: OrderProductsSummary,
  clienteUbicacionCodigo: string,
  fecha: Date = new Date(),
): PatagoniaCreatePedido {
  return {
    codigo: `${summary.id}TN`,
    clienteUbicacionCodigo,
    fecha: fecha.toISOString(),
    estado: 'Pendiente',
    observacion: formatOrderObservacion(summary.userData),
    items: buildItems(summary.products),
  };
}
