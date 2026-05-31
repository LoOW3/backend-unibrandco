import type { TiendanubeConfig, TiendanubeFulfillmentOrder } from './tiendanube.types';

const RETRY_BACKOFF_MS = 2000;
const MAX_RETRIES = 3;

/**
 * Fetches a fulfillment order from the Tiendanube API.
 */
export async function fetchTiendanubeFulfillmentOrder(
  config: TiendanubeConfig,
  apiVersion: string,
  orderId: number,
  fulfillmentOrderId: string,
  attempt = 0,
): Promise<TiendanubeFulfillmentOrder> {
  const url = `https://api.tiendanube.com/${apiVersion}/${config.store_id}/orders/${orderId}/fulfillment-orders/${fulfillmentOrderId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      'User-Agent': config.user_agent,
      Accept: 'application/json',
    },
  });

  if (response.status === 429 && attempt < MAX_RETRIES) {
    await sleep(RETRY_BACKOFF_MS * (attempt + 1));
    return fetchTiendanubeFulfillmentOrder(
      config,
      apiVersion,
      orderId,
      fulfillmentOrderId,
      attempt + 1,
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Tiendanube fulfillment GET failed: ${response.status} ${response.statusText} - ${body.slice(0, 500)}`,
    );
  }

  return (await response.json()) as TiendanubeFulfillmentOrder;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
