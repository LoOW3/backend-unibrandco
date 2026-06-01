import type { Context } from 'aws-lambda';

import type { TiendanubeFulfillmentShipEvent } from '../../shared/tiendanube-fulfillment-ship.types';

import { processFulfillmentShip } from './process-fulfillment-ship';
import type { TiendanubeFulfillmentShipEnv } from './types';

function getEnv(): TiendanubeFulfillmentShipEnv {
  const secretArn = process.env.TIENDANUBE_SECRET_ARN;
  const apiVersion = process.env.TIENDANUBE_API_VERSION ?? '2025-03';
  const tableName = process.env.PATAGONIA_PEDIDOS_TABLE_NAME;

  if (!secretArn || !tableName) {
    throw new Error('Missing required environment variables for Tiendanube fulfillment ship');
  }

  return {
    TIENDANUBE_SECRET_ARN: secretArn,
    TIENDANUBE_API_VERSION: apiVersion,
    PATAGONIA_PEDIDOS_TABLE_NAME: tableName,
  };
}

function isFulfillmentShipEvent(value: unknown): value is TiendanubeFulfillmentShipEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.tiendanubeOrderId === 'number' &&
    typeof record.digipCodigo === 'string' &&
    record.digipCodigo.length > 0
  );
}

/**
 * Marks Tiendanube fulfillments PACKED after Digip Pedido_Completo.
 */
export async function handler(event: unknown, _context: Context): Promise<void> {
  if (!isFulfillmentShipEvent(event)) {
    throw new Error('Invalid event: expected Tiendanube fulfillment ship payload');
  }

  const env = getEnv();

  try {
    const result = await processFulfillmentShip(env, event);

    console.log(
      JSON.stringify({
        action: 'tiendanube fulfillment ship completed',
        ...result,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error(
      JSON.stringify({
        action: 'tiendanube fulfillment ship failed',
        tiendanubeOrderId: event.tiendanubeOrderId,
        digipCodigo: event.digipCodigo,
        message,
      }),
    );

    throw error;
  }
}
