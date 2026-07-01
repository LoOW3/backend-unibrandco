import type {
  TiendanubeConfig,
  TiendanubeStockPatchItem,
} from '../../../shared/tiendanube.types';

const RETRY_BACKOFF_MS = 2_000;
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PATCHes a single chunk of stock updates to Tiendanube, retrying on 429.
 * Mirrors the chunk sender in tiendanube-stock-sync/patch-tiendanube-stock.ts.
 */
export async function patchStockChunk(
  config: TiendanubeConfig,
  apiVersion: string,
  chunk: TiendanubeStockPatchItem[],
  attempt = 0,
): Promise<void> {
  const url = `https://api.tiendanube.com/${apiVersion}/${config.store_id}/products/stock-price`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${config.access_token}`,
      'User-Agent': config.user_agent,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chunk),
  });

  if (response.status === 429 && attempt < MAX_RETRIES) {
    await sleep(RETRY_BACKOFF_MS * (attempt + 1));
    return patchStockChunk(config, apiVersion, chunk, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Tiendanube stock-price PATCH failed: ${response.status} ${response.statusText} - ${body.slice(0, 500)}`,
    );
  }
}
