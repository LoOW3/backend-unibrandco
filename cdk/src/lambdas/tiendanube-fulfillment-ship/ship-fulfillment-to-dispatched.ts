import { fetchTiendanubeFulfillmentOrder } from '../../shared/fetch-tiendanube-fulfillment';
import { fetchTiendanubeOrder } from '../../shared/fetch-tiendanube-order';
import { getTiendanubeConfig } from '../../shared/get-tiendanube-config';
import { patchTiendanubeFulfillmentStatus } from '../../shared/patch-tiendanube-fulfillment';
import type { TiendanubeConfig, TiendanubeFulfillmentOrderStatus } from '../../shared/tiendanube.types';

const TARGET_STATUS: TiendanubeFulfillmentOrderStatus = 'PACKED';
const SKIP_STATUSES = new Set<TiendanubeFulfillmentOrderStatus>([
  'PACKED',
  'DISPATCHED',
  'DELIVERED',
]);

export interface ShipFulfillmentResult {
  patchedIds: string[];
  skippedIds: string[];
}

/**
 * PATCHes each order fulfillment to PACKED.
 */
export async function shipFulfillmentToDispatched(
  config: TiendanubeConfig,
  apiVersion: string,
  orderId: number,
): Promise<ShipFulfillmentResult> {
  const order = await fetchTiendanubeOrder(config, apiVersion, orderId);
  const fulfillmentIds = order.fulfillments ?? [];

  if (fulfillmentIds.length === 0) {
    return { patchedIds: [], skippedIds: [] };
  }

  const patchedIds: string[] = [];
  const skippedIds: string[] = [];

  for (const fulfillmentOrderId of fulfillmentIds) {
    const current = await fetchTiendanubeFulfillmentOrder(
      config,
      apiVersion,
      orderId,
      fulfillmentOrderId,
    );

    if (current.status && SKIP_STATUSES.has(current.status)) {
      skippedIds.push(fulfillmentOrderId);
      continue;
    }

    await patchTiendanubeFulfillmentStatus(
      config,
      apiVersion,
      orderId,
      fulfillmentOrderId,
      TARGET_STATUS,
    );
    patchedIds.push(fulfillmentOrderId);
  }

  return { patchedIds, skippedIds };
}
