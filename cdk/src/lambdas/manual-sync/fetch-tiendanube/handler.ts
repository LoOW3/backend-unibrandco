import type { Context } from 'aws-lambda';

import { getTiendanubeConfig } from '../../../shared/get-tiendanube-config';
import { throwIfAborted } from '../abort';
import { getApiVersion, getBucketName } from '../env';
import { fetchAllProducts, PRODUCTS_PAGE_SIZE } from '../fetch-tiendanube-products';
import { markStepCompleted, markStepRunning, updateFetchProgress } from '../manifest';
import { putJson } from '../s3-json';
import { ARTIFACT_KEYS, type ManualSyncState } from '../types';

/**
 * Fetches the full Tiendanube catalog (paginated) and stores products.json.
 */
export async function handler(
  state: ManualSyncState,
  _context: Context,
): Promise<ManualSyncState> {
  const bucket = getBucketName();
  await throwIfAborted(bucket, state.runPrefix);
  await markStepRunning(bucket, state.runPrefix, 'fetch-tiendanube', new Date().toISOString());

  const config = getTiendanubeConfig();
  const apiVersion = getApiVersion();
  const { products, expectedTotal } = await fetchAllProducts(
    config,
    apiVersion,
    async ({ pagesFetched, expectedTotal: total, productsSoFar }) => {
      await throwIfAborted(bucket, state.runPrefix);
      const pagesTotal = total ? Math.ceil(total / PRODUCTS_PAGE_SIZE) : pagesFetched;
      await updateFetchProgress(
        bucket,
        state.runPrefix,
        pagesFetched,
        pagesTotal,
        productsSoFar,
      );
    },
  );

  const payload = {
    store_id: config.store_id,
    fetched_at: new Date().toISOString(),
    total_count: expectedTotal ?? products.length,
    page_size: 200,
    products,
  };

  const key = `${state.runPrefix}${ARTIFACT_KEYS.products}`;
  const sizeBytes = await putJson(bucket, key, payload);

  await markStepCompleted(bucket, state.runPrefix, 'fetch-tiendanube', new Date().toISOString(), {
    result: { productCount: products.length, expectedTotal },
    artifacts: [{ label: 'Tiendanube catalog', s3Key: key, sizeBytes }],
    counts: { tnProducts: products.length },
  });

  return state;
}
