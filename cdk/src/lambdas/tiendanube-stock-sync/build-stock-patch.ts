import type { StockChangeItem } from '../../shared/patagonia-stock.types';
import type {
  SkuMapping,
  TiendanubeStockPatchItem,
} from '../../shared/tiendanube.types';

import type { BuildStockPatchResult } from './types';

/**
 * Maps stock change items to Tiendanube stock-price PATCH payload items.
 */
export function buildStockPatch(
  changedItems: StockChangeItem[],
  skuIndex: Map<string, SkuMapping>,
): BuildStockPatchResult {
  const skippedDeleted: string[] = [];
  const skippedNoSku: string[] = [];
  const productMap = new Map<number, TiendanubeStockPatchItem>();
  let matchedCount = 0;

  for (const item of changedItems) {
    if (item.deleted) {
      skippedDeleted.push(item.CodigoArticulo);
      continue;
    }

    const mapping = skuIndex.get(item.CodigoArticulo);
    if (!mapping) {
      skippedNoSku.push(item.CodigoArticulo);
      continue;
    }

    matchedCount += 1;

    const variantPatch = {
      id: mapping.variantId,
      inventory_levels: [{ stock: item.UnidadesDisponibles }],
    };

    const existingProduct = productMap.get(mapping.productId);
    if (existingProduct) {
      existingProduct.variants.push(variantPatch);
      continue;
    }

    productMap.set(mapping.productId, {
      id: mapping.productId,
      variants: [variantPatch],
    });
  }

  return {
    patchItems: Array.from(productMap.values()),
    matchedCount,
    skippedDeleted,
    skippedNoSku,
  };
}

/** Splits patch items into fixed-size chunks for API requests. */
export function chunkPatchItems(
  patchItems: TiendanubeStockPatchItem[],
  chunkSize: number,
): TiendanubeStockPatchItem[][] {
  const chunks: TiendanubeStockPatchItem[][] = [];

  for (let index = 0; index < patchItems.length; index += chunkSize) {
    chunks.push(patchItems.slice(index, index + chunkSize));
  }

  return chunks;
}
