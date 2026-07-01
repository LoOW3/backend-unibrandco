import type { PatagoniaStockItem } from '../../shared/patagonia-stock.types';
import type {
  ProductsCleanProduct,
  SkuMapping,
  TiendanubeStockPatchItem,
} from '../../shared/tiendanube.types';

export interface SkippedStockItem {
  CodigoArticulo: string;
  UnidadesDisponibles: number;
}

export interface BuildStockPatchResult {
  patchItems: TiendanubeStockPatchItem[];
  matchedCount: number;
  skippedItems: SkippedStockItem[];
}

/** Builds a lookup from variant SKU to Tiendanube product/variant IDs. */
export function buildSkuIndex(
  products: ProductsCleanProduct[],
): Map<string, SkuMapping> {
  const index = new Map<string, SkuMapping>();

  for (const product of products) {
    if (typeof product.id !== 'number') {
      continue;
    }

    for (const variant of product.variants ?? []) {
      if (!variant.sku || typeof variant.id !== 'number') {
        continue;
      }
      index.set(String(variant.sku), {
        productId: product.id,
        variantId: variant.id,
      });
    }
  }

  return index;
}

/**
 * Maps a full Patagonia snapshot to a Tiendanube stock-price PATCH payload,
 * patching every matched SKU. Mirrors scripts/build_tiendanube_stock_patch.py.
 */
export function buildManualStockPatch(
  stockItems: PatagoniaStockItem[],
  skuIndex: Map<string, SkuMapping>,
): BuildStockPatchResult {
  const skippedItems: SkippedStockItem[] = [];
  const productMap = new Map<number, TiendanubeStockPatchItem>();
  let matchedCount = 0;

  for (const item of stockItems) {
    const codigoArticulo = item.CodigoArticulo;
    const unidadesDisponibles = item.UnidadesDisponibles;

    if (!codigoArticulo || unidadesDisponibles === null || unidadesDisponibles === undefined) {
      continue;
    }

    const stock = Math.trunc(unidadesDisponibles);
    const mapping = skuIndex.get(String(codigoArticulo));

    if (!mapping) {
      skippedItems.push({
        CodigoArticulo: String(codigoArticulo),
        UnidadesDisponibles: stock,
      });
      continue;
    }

    matchedCount += 1;
    const variantPatch = {
      id: mapping.variantId,
      inventory_levels: [{ stock }],
    };

    const existing = productMap.get(mapping.productId);
    if (existing) {
      existing.variants.push(variantPatch);
      continue;
    }

    productMap.set(mapping.productId, {
      id: mapping.productId,
      variants: [variantPatch],
    });
  }

  const patchItems = Array.from(productMap.values()).sort(
    (left, right) => left.id - right.id,
  );

  return { patchItems, matchedCount, skippedItems };
}
