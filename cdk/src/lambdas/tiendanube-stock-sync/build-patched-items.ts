import type { StockChangeItem } from '../../shared/patagonia-stock.types';
import type { SkuMapping } from '../../shared/tiendanube.types';
import type { TiendanubePatchedItem } from '../../shared/stock-changes.types';

/**
 * Builds the list of items successfully patched to Tiendanube.
 */
export function buildPatchedItems(
  changedItems: StockChangeItem[],
  skuIndex: Map<string, SkuMapping>,
): TiendanubePatchedItem[] {
  const patchedItems: TiendanubePatchedItem[] = [];

  for (const item of changedItems) {
    if (item.deleted) {
      continue;
    }

    if (!skuIndex.has(item.CodigoArticulo)) {
      continue;
    }

    patchedItems.push({
      sku: item.CodigoArticulo,
      newStock: item.UnidadesDisponibles,
      previousStock: item.previousUnidadesDisponibles,
    });
  }

  return patchedItems;
}
