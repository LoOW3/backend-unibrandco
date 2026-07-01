import { getTiendanubeConfig } from '../../shared/get-tiendanube-config';
import { buildPatchedItems } from './build-patched-items';
import { buildStockPatch } from './build-stock-patch';
import { loadProductsCatalog } from './load-products-catalog';
import { patchTiendanubeStock } from './patch-tiendanube-stock';
import { saveTiendanubeSync } from './save-tiendanube-sync';
import type { SkuMapping } from '../../shared/tiendanube.types';
import type {
  ParsedStreamRecord,
  TiendanubeStockSyncEnv,
  TiendanubeStockSyncResult,
} from './types';

function extractSyncKey(pk: string): string {
  return pk.startsWith('SYNC#') ? pk.slice('SYNC#'.length) : pk;
}

async function persistTiendanubeSync(
  env: TiendanubeStockSyncEnv,
  pk: string,
  syncKey: string,
  result: TiendanubeStockSyncResult,
  changedItems: ParsedStreamRecord['changedItems'],
  skuIndex: Map<string, SkuMapping>,
  triggeredBy: string | null,
): Promise<void> {
  const patchedItems = buildPatchedItems(changedItems, skuIndex);
  const patchedAt = new Date().toISOString();

  const tiendanubeSync = {
    patchedAt,
    patchedCount: result.patchedCount ?? 0,
    patchedItems,
    matchedCount: result.matchedCount ?? 0,
    skippedDeleted: result.skippedDeleted ?? 0,
    skippedNoSku: result.skippedNoSku ?? 0,
  };

  await saveTiendanubeSync(
    env.STOCK_CHANGES_TABLE_NAME,
    pk,
    syncKey,
    tiendanubeSync,
    triggeredBy,
  );
}

/**
 * Processes a parsed DynamoDB stream record and syncs stock to Tiendanube.
 */
export async function processTiendanubeStockSync(
  env: TiendanubeStockSyncEnv,
  parsed: ParsedStreamRecord,
): Promise<TiendanubeStockSyncResult> {
  const { pk, changedItems } = parsed;
  const syncKey = extractSyncKey(pk);

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

    await persistTiendanubeSync(
      env,
      pk,
      syncKey,
      result,
      changedItems,
      catalog.skuIndex,
      parsed.triggeredBy ?? null,
    );

    console.log(JSON.stringify({ action: 'tiendanube stock sync skipped', ...result }));
    return result;
  }

  const config = getTiendanubeConfig();
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

  await persistTiendanubeSync(
    env,
    pk,
    syncKey,
    result,
    changedItems,
    catalog.skuIndex,
    parsed.triggeredBy ?? null,
  );

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
