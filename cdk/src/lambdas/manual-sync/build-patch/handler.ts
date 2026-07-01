import type { Context } from 'aws-lambda';

import type { PatagoniaStockItem } from '../../../shared/patagonia-stock.types';
import type { ProductsCleanExport } from '../../../shared/tiendanube.types';
import { getBucketName } from '../env';
import { buildManualStockPatch, buildSkuIndex } from '../build-patch';
import { markStepCompleted, markStepRunning } from '../manifest';
import { getJson, putJson } from '../s3-json';
import { ARTIFACT_KEYS, type ManualSyncState } from '../types';

/**
 * Builds the Tiendanube stock-price PATCH payload from the Patagonia snapshot
 * and the fresh catalog, writing stock-patch.json + skipped-skus.json.
 */
export async function handler(
  state: ManualSyncState,
  _context: Context,
): Promise<ManualSyncState> {
  const bucket = getBucketName();
  await markStepRunning(bucket, state.runPrefix, 'build-patch', new Date().toISOString());

  const stockKey = `${state.runPrefix}${ARTIFACT_KEYS.patagoniaStock}`;
  const cleanKey = `${state.runPrefix}${ARTIFACT_KEYS.productsClean}`;

  const [stockItems, clean] = await Promise.all([
    getJson<PatagoniaStockItem[]>(bucket, stockKey),
    getJson<ProductsCleanExport>(bucket, cleanKey),
  ]);

  const skuIndex = buildSkuIndex(clean.products ?? []);
  const { patchItems, matchedCount, skippedItems } = buildManualStockPatch(
    stockItems,
    skuIndex,
  );

  const patchKey = `${state.runPrefix}${ARTIFACT_KEYS.stockPatch}`;
  const patchSize = await putJson(bucket, patchKey, patchItems);

  const skippedKey = `${state.runPrefix}${ARTIFACT_KEYS.skippedSkus}`;
  const skippedReport = {
    source_stock: stockKey,
    source_catalog: cleanKey,
    total_snapshot_items: stockItems.length,
    matched_count: matchedCount,
    skipped_count: skippedItems.length,
    skipped_items: skippedItems,
  };
  const skippedSize = await putJson(bucket, skippedKey, skippedReport);

  await markStepCompleted(bucket, state.runPrefix, 'build-patch', new Date().toISOString(), {
    result: {
      products: patchItems.length,
      matched: matchedCount,
      skipped: skippedItems.length,
    },
    artifacts: [
      { label: 'Stock patch', s3Key: patchKey, sizeBytes: patchSize },
      { label: 'Skipped SKUs', s3Key: skippedKey, sizeBytes: skippedSize },
    ],
    counts: { matched: matchedCount, skipped: skippedItems.length },
  });

  return { ...state, sendCursor: 0 };
}
