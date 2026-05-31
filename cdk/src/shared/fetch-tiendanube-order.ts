import type { TiendanubeConfig, TiendanubeOrder } from './tiendanube.types';

const RETRY_BACKOFF_MS = 2000;
const MAX_RETRIES = 3;

/**
 * Fetches a single order from the Tiendanube API.
 */
export async function fetchTiendanubeOrder(
  config: TiendanubeConfig,
  apiVersion: string,
  orderId: number,
  attempt = 0,
): Promise<TiendanubeOrder> {
  const url = `https://api.tiendanube.com/${apiVersion}/${config.store_id}/orders/${orderId}`;

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
    return fetchTiendanubeOrder(config, apiVersion, orderId, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Tiendanube order GET failed: ${response.status} ${response.statusText} - ${body.slice(0, 500)}`,
    );
  }

  return (await response.json()) as TiendanubeOrder;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
