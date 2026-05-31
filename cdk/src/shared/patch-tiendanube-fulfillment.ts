import type { TiendanubeConfig, TiendanubeFulfillmentOrderStatus } from './tiendanube.types';

const RETRY_BACKOFF_MS = 2000;
const MAX_RETRIES = 3;

export interface PatchFulfillmentResult {
  fulfillmentOrderId: string;
  status: TiendanubeFulfillmentOrderStatus;
}

/**
 * PATCHes a fulfillment order status on Tiendanube.
 */
export async function patchTiendanubeFulfillmentStatus(
  config: TiendanubeConfig,
  apiVersion: string,
  orderId: number,
  fulfillmentOrderId: string,
  status: TiendanubeFulfillmentOrderStatus,
  attempt = 0,
): Promise<PatchFulfillmentResult> {
  const url = `https://api.tiendanube.com/${apiVersion}/${config.store_id}/orders/${orderId}/fulfillment-orders/${fulfillmentOrderId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      'User-Agent': config.user_agent,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (response.status === 429 && attempt < MAX_RETRIES) {
    await sleep(RETRY_BACKOFF_MS * (attempt + 1));
    return patchTiendanubeFulfillmentStatus(
      config,
      apiVersion,
      orderId,
      fulfillmentOrderId,
      status,
      attempt + 1,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Tiendanube fulfillment PATCH failed: ${response.status} ${response.statusText} - ${body.slice(0, 500)}`,
    );
  }

  return { fulfillmentOrderId, status };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
