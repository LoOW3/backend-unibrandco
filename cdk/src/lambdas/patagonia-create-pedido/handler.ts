import type { Context } from 'aws-lambda';

import { mapSummaryToCreatePedido, MapSummaryToPedidoError } from '../../shared/map-summary-to-create-pedido';
import { postPatagoniaPedido } from '../../shared/post-patagonia-pedido';
import {
  TIENDANUBE_ORDER_PRODUCTS_SUMMARY_ACTION,
  type TiendanubeOrderProductsSummaryEvent,
} from '../../shared/tiendanube.types';

import { savePatagoniaPedido } from './save-patagonia-pedido';
import type { PatagoniaCreatePedidoEnv } from './types';

function getEnv(): PatagoniaCreatePedidoEnv {
  const apiUrl = process.env.PATAGONIA_PEDIDOS_API_URL;
  const tableName = process.env.PATAGONIA_PEDIDOS_TABLE_NAME;
  const clienteUbicacionCodigo = process.env.CLIENTE_UBICACION_CODIGO ?? '8436326823';

  if (!apiUrl || !tableName) {
    throw new Error('Missing required environment variables for Patagonia create pedido');
  }

  return {
    PATAGONIA_PEDIDOS_API_URL: apiUrl,
    CLIENTE_UBICACION_CODIGO: clienteUbicacionCodigo,
    PATAGONIA_PEDIDOS_TABLE_NAME: tableName,
  };
}

function isSummaryEvent(value: unknown): value is TiendanubeOrderProductsSummaryEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.action === TIENDANUBE_ORDER_PRODUCTS_SUMMARY_ACTION &&
    typeof record.summary === 'object' &&
    record.summary !== null
  );
}

/**
 * Lambda handler: maps Tiendanube order summary to DigipWMS and POSTs CreatePedido.
 */
export async function handler(
  event: unknown,
  _context: Context,
): Promise<void> {
  if (!isSummaryEvent(event)) {
    throw new Error('Invalid event: expected Tiendanube order products summary payload');
  }

  const env = getEnv();

  try {
    const createPedido = mapSummaryToCreatePedido(
      event.summary,
      env.CLIENTE_UBICACION_CODIGO,
    );

    console.log(
      JSON.stringify({
        action: 'patagonia create pedido request',
        codigo: createPedido.codigo,
        itemCount: createPedido.items.length,
      }),
    );

    await postPatagoniaPedido(
      env.PATAGONIA_PEDIDOS_API_URL,
      createPedido,
    );

    await savePatagoniaPedido({
      tableName: env.PATAGONIA_PEDIDOS_TABLE_NAME,
      summary: event.summary,
      createPedido,
    });

    console.log(
      JSON.stringify({
        action: 'patagonia create pedido completed',
        codigo: createPedido.codigo,
      }),
    );
  } catch (error) {
    const message =
      error instanceof MapSummaryToPedidoError || error instanceof Error
        ? error.message
        : 'Unknown error';

    console.error(
      JSON.stringify({
        action: 'patagonia create pedido failed',
        orderId: event.summary.id,
        message,
      }),
    );

    throw error;
  }
}
