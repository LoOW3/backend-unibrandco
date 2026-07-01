import { getTiendanubeConfig } from '../../shared/get-tiendanube-config';
import type { TiendanubeFulfillmentShipEvent } from '../../shared/tiendanube-fulfillment-ship.types';

import { shipFulfillmentToDispatched } from './ship-fulfillment-to-dispatched';
import type { TiendanubeFulfillmentShipEnv } from './types';
import { updatePatagoniaPedidoShipped } from './update-patagonia-pedido-shipped';

export interface ProcessFulfillmentShipResult {
  tiendanubeOrderId: number;
  digipCodigo: string;
  patchedCount: number;
  skippedCount: number;
  dynamoUpdated: boolean;
}

/**
 * Fetches Tiendanube order fulfillments, marks PACKED, updates DynamoDB pedido record.
 */
export async function processFulfillmentShip(
  env: TiendanubeFulfillmentShipEnv,
  event: TiendanubeFulfillmentShipEvent,
): Promise<ProcessFulfillmentShipResult> {
  const config = getTiendanubeConfig();
  const { patchedIds, skippedIds } = await shipFulfillmentToDispatched(
    config,
    env.TIENDANUBE_API_VERSION,
    event.tiendanubeOrderId,
  );

  if (patchedIds.length === 0 && skippedIds.length === 0) {
    console.log(
      JSON.stringify({
        action: 'tiendanube ship skipped no fulfillments',
        tiendanubeOrderId: event.tiendanubeOrderId,
        digipCodigo: event.digipCodigo,
      }),
    );

    return {
      tiendanubeOrderId: event.tiendanubeOrderId,
      digipCodigo: event.digipCodigo,
      patchedCount: 0,
      skippedCount: 0,
      dynamoUpdated: false,
    };
  }

  let dynamoUpdated = false;

  if (patchedIds.length > 0 || skippedIds.length > 0) {
    const allIds = [...patchedIds, ...skippedIds];

    try {
      dynamoUpdated = await updatePatagoniaPedidoShipped({
        tableName: env.PATAGONIA_PEDIDOS_TABLE_NAME,
        digipCodigo: event.digipCodigo,
        fulfillmentStatus: 'PACKED',
        shippedAt: new Date().toISOString(),
        tiendanubeFulfillmentIds: allIds,
        digipCompletoAt: event.digipCompletoAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('ConditionalCheckFailed')) {
        console.warn(
          JSON.stringify({
            action: 'tiendanube ship dynamo record not found',
            digipCodigo: event.digipCodigo,
            tiendanubeOrderId: event.tiendanubeOrderId,
          }),
        );
      } else {
        throw error;
      }
    }
  }

  return {
    tiendanubeOrderId: event.tiendanubeOrderId,
    digipCodigo: event.digipCodigo,
    patchedCount: patchedIds.length,
    skippedCount: skippedIds.length,
    dynamoUpdated,
  };
}
