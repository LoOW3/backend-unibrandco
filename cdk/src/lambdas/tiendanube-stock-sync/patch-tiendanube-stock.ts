import type {
  TiendanubeConfig,
  TiendanubeStockPatchItem,
} from '../../shared/tiendanube.types';

import { chunkPatchItems } from './build-stock-patch';

const PATCH_CHUNK_SIZE = 50;
const RETRY_BACKOFF_MS = 2000;
const MAX_RETRIES = 3;

/**
 * PATCHes stock updates to the Tiendanube stock-price endpoint.
 */
export async function patchTiendanubeStock(
  config: TiendanubeConfig,
  apiVersion: string,
  patchItems: TiendanubeStockPatchItem[],
): Promise<number> {
  const chunks = chunkPatchItems(patchItems, PATCH_CHUNK_SIZE);
  let patchedCount = 0;

  for (const chunk of chunks) {
    await patchChunk(config, apiVersion, chunk);
    patchedCount += chunk.length;
  }

  return patchedCount;
}

async function patchChunk(
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
    return patchChunk(config, apiVersion, chunk, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Tiendanube stock-price PATCH failed: ${response.status} ${response.statusText} - ${body.slice(0, 500)}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
