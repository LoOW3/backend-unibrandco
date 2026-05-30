import type {
  PatagoniaStockItem,
  StockChangeItem,
} from '../../shared/patagonia-stock.types';

function buildItemMap(items: PatagoniaStockItem[]): Map<string, PatagoniaStockItem> {
  return new Map(items.map((item) => [item.CodigoArticulo, item]));
}

/**
 * Compares two stock snapshots and returns items with UnidadesDisponibles changes.
 */
export function compareStockSnapshots(
  currentItems: PatagoniaStockItem[],
  previousItems: PatagoniaStockItem[],
): StockChangeItem[] {
  const currentMap = buildItemMap(currentItems);
  const previousMap = buildItemMap(previousItems);
  const changes: StockChangeItem[] = [];

  for (const [code, currentItem] of currentMap) {
    const previousItem = previousMap.get(code);

    if (!previousItem) {
      changes.push({ ...currentItem, new: true });
      continue;
    }

    if (previousItem.UnidadesDisponibles !== currentItem.UnidadesDisponibles) {
      changes.push({
        ...currentItem,
        previousUnidadesDisponibles: previousItem.UnidadesDisponibles,
      });
    }
  }

  for (const [code, previousItem] of previousMap) {
    if (!currentMap.has(code)) {
      changes.push({ ...previousItem, deleted: true });
    }
  }

  return changes;
}
