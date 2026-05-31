import { fetchTiendanubeFulfillmentOrder } from '../../shared/fetch-tiendanube-fulfillment';
import { fetchTiendanubeOrder } from '../../shared/fetch-tiendanube-order';
import { getTiendanubeConfig } from '../../shared/get-tiendanube-config';
import { patchTiendanubeFulfillmentStatus } from '../../shared/patch-tiendanube-fulfillment';
import type { TiendanubeConfig, TiendanubeFulfillmentOrderStatus } from '../../shared/tiendanube.types';

const TARGET_STATUS: TiendanubeFulfillmentOrderStatus = 'DISPATCHED';
const SKIP_STATUSES = new Set<TiendanubeFulfillmentOrderStatus>(['DISPATCHED', 'DELIVERED']);

export interface ShipFulfillmentResult {
  patchedIds: string[];
  skippedIds: string[];
}

/**
 * PATCHes each order fulfillment to DISPATCHED (with PACKED intermediate if needed).
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

    await patchToDispatched(config, apiVersion, orderId, fulfillmentOrderId, current.status);
    patchedIds.push(fulfillmentOrderId);
  }

  return { patchedIds, skippedIds };
}

async function patchToDispatched(
  config: TiendanubeConfig,
  apiVersion: string,
  orderId: number,
  fulfillmentOrderId: string,
  currentStatus?: TiendanubeFulfillmentOrderStatus,
): Promise<void> {
  try {
    await patchTiendanubeFulfillmentStatus(
      config,
      apiVersion,
      orderId,
      fulfillmentOrderId,
      TARGET_STATUS,
    );
    return;
  } catch (error) {
    if (currentStatus !== 'UNPACKED' || !isWorkflowError(error)) {
      throw error;
    }
  }

  await patchTiendanubeFulfillmentStatus(
    config,
    apiVersion,
    orderId,
    fulfillmentOrderId,
    'PACKED',
  );

  await patchTiendanubeFulfillmentStatus(
    config,
    apiVersion,
    orderId,
    fulfillmentOrderId,
    TARGET_STATUS,
  );
}

function isWorkflowError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('400');
}
