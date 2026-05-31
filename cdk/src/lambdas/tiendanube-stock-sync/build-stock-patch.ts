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

/** Counts variants across patch products. */
export function countPatchVariants(
  patchItems: TiendanubeStockPatchItem[],
): number {
  return patchItems.reduce(
    (total, product) => total + product.variants.length,
    0,
  );
}

/** Splits patch items so each chunk has at most maxVariants variants. */
export function chunkPatchItems(
  patchItems: TiendanubeStockPatchItem[],
  maxVariants: number,
): TiendanubeStockPatchItem[][] {
  const chunks: TiendanubeStockPatchItem[][] = [];
  let currentChunk: TiendanubeStockPatchItem[] = [];
  let currentVariantCount = 0;

  for (const product of patchItems) {
    const productVariantCount = product.variants.length;

    if (productVariantCount > maxVariants) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentVariantCount = 0;
      }

      for (let index = 0; index < productVariantCount; index += maxVariants) {
        chunks.push([
          {
            id: product.id,
            variants: product.variants.slice(index, index + maxVariants),
          },
        ]);
      }

      continue;
    }

    if (currentVariantCount + productVariantCount > maxVariants) {
      chunks.push(currentChunk);
      currentChunk = [product];
      currentVariantCount = productVariantCount;
      continue;
    }

    currentChunk.push(product);
    currentVariantCount += productVariantCount;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}
