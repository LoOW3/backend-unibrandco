import { getTiendanubeConfig } from './get-tiendanube-config';
import { buildStockPatch } from './build-stock-patch';
import { loadProductsCatalog } from './load-products-catalog';
import { patchTiendanubeStock } from './patch-tiendanube-stock';
import type {
  ParsedStreamRecord,
  TiendanubeStockSyncEnv,
  TiendanubeStockSyncResult,
} from './types';

/**
 * Processes a parsed DynamoDB stream record and syncs stock to Tiendanube.
 */
export async function processTiendanubeStockSync(
  env: TiendanubeStockSyncEnv,
  parsed: ParsedStreamRecord,
): Promise<TiendanubeStockSyncResult> {
  const { pk, changedItems } = parsed;

  const catalog = await loadProductsCatalog(
    env.STOCK_BUCKET_NAME,
    env.PRODUCTS_CLEAN_S3_KEY,
  );

  const patchResult = buildStockPatch(changedItems, catalog.skuIndex);

  if (patchResult.patchItems.length === 0) {
    const result: TiendanubeStockSyncResult = {
      pk,
      skipped: true,
      reason: 'No patchable items after filtering',
      changedCount: changedItems.length,
      matchedCount: patchResult.matchedCount,
      skippedDeleted: patchResult.skippedDeleted.length,
      skippedNoSku: patchResult.skippedNoSku.length,
      patchedCount: 0,
    };

    console.log(JSON.stringify({ action: 'tiendanube stock sync skipped', ...result }));
    return result;
  }

  const config = await getTiendanubeConfig(env.TIENDANUBE_SECRET_ARN);
  const patchedCount = await patchTiendanubeStock(
    config,
    env.TIENDANUBE_API_VERSION,
    patchResult.patchItems,
  );

  const result: TiendanubeStockSyncResult = {
    pk,
    changedCount: changedItems.length,
    matchedCount: patchResult.matchedCount,
    skippedDeleted: patchResult.skippedDeleted.length,
    skippedNoSku: patchResult.skippedNoSku.length,
    patchedCount,
  };

  if (patchResult.skippedNoSku.length > 0) {
    console.warn(
      JSON.stringify({
        action: 'tiendanube stock sync sku not found',
        pk,
        skus: patchResult.skippedNoSku,
      }),
    );
  }

  console.log(JSON.stringify({ action: 'tiendanube stock sync completed', ...result }));
  return result;
}
