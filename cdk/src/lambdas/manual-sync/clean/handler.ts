import type { Context } from 'aws-lambda';

import { throwIfAborted } from '../abort';
import { getBucketName } from '../env';
import { cleanProducts, type RawProductsExport } from '../clean-products';
import { markStepCompleted, markStepRunning } from '../manifest';
import { getJson, putJson } from '../s3-json';
import { ARTIFACT_KEYS, type ManualSyncState } from '../types';

/**
 * Minimizes products.json into products-clean.json for the run.
 */
export async function handler(
  state: ManualSyncState,
  _context: Context,
): Promise<ManualSyncState> {
  const bucket = getBucketName();
  await throwIfAborted(bucket, state.runPrefix);
  await markStepRunning(bucket, state.runPrefix, 'clean', new Date().toISOString());

  const sourceKey = `${state.runPrefix}${ARTIFACT_KEYS.products}`;
  const raw = await getJson<RawProductsExport>(bucket, sourceKey);
  const cleanedProducts = cleanProducts(raw.products ?? []);

  const payload = {
    source: sourceKey,
    source_fetched_at: raw.fetched_at ?? null,
    generated_at: new Date().toISOString(),
    total_count: cleanedProducts.length,
    products: cleanedProducts,
  };

  const key = `${state.runPrefix}${ARTIFACT_KEYS.productsClean}`;
  const sizeBytes = await putJson(bucket, key, payload);

  await markStepCompleted(bucket, state.runPrefix, 'clean', new Date().toISOString(), {
    result: { productCount: cleanedProducts.length },
    artifacts: [{ label: 'Clean catalog', s3Key: key, sizeBytes }],
  });

  return state;
}
