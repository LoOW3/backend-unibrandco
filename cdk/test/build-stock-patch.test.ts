import type { PatagoniaStockItem, StockChangeItem } from '../src/shared/patagonia-stock.types';
import {
  buildStockPatch,
  chunkPatchItems,
  countPatchVariants,
} from '../src/lambdas/tiendanube-stock-sync/build-stock-patch';
import type { SkuMapping } from '../src/shared/tiendanube.types';

function buildItem(
  codigoArticulo: string,
  unidadesDisponibles: number,
): PatagoniaStockItem {
  return {
    CodigoArticulo: codigoArticulo,
    UnidadesDisponibles: unidadesDisponibles,
    UnidadesReservadas: 0,
    UnidadesBloqueadas: 0,
    UnidadesADespachar: 0,
    UnidadesEnRecepcion: 0,
    UnidadesTransitoInterno: 0,
    UnidadesVencidas: 0,
    UnidadesPedidas: 0,
  };
}

describe('buildStockPatch', () => {
  const skuIndex = new Map<string, SkuMapping>([
    ['SS03006', { productId: 300367037, variantId: 1339341913 }],
    ['SS03007', { productId: 300367037, variantId: 1339341914 }],
    ['AN03027', { productId: 300400016, variantId: 1339400000 }],
  ]);

  it('maps matched SKUs to Tiendanube stock patch items', () => {
    const changedItems: StockChangeItem[] = [
      { ...buildItem('SS03006', 36), previousUnidadesDisponibles: 10 },
    ];

    const result = buildStockPatch(changedItems, skuIndex);

    expect(result.patchItems).toEqual([
      {
        id: 300367037,
        variants: [
          {
            id: 1339341913,
            inventory_levels: [{ stock: 36 }],
          },
        ],
      },
    ]);
    expect(result.matchedCount).toBe(1);
    expect(result.skippedDeleted).toEqual([]);
    expect(result.skippedNoSku).toEqual([]);
  });

  it('groups multiple SKUs from the same product into one patch item', () => {
    const changedItems: StockChangeItem[] = [
      { ...buildItem('SS03006', 36) },
      { ...buildItem('SS03007', 12) },
    ];

    const result = buildStockPatch(changedItems, skuIndex);

    expect(result.patchItems).toEqual([
      {
        id: 300367037,
        variants: [
          {
            id: 1339341913,
            inventory_levels: [{ stock: 36 }],
          },
          {
            id: 1339341914,
            inventory_levels: [{ stock: 12 }],
          },
        ],
      },
    ]);
    expect(result.matchedCount).toBe(2);
  });

  it('skips deleted items', () => {
    const changedItems: StockChangeItem[] = [
      { ...buildItem('YY88888', 2), deleted: true },
      { ...buildItem('SS03006', 36) },
    ];

    const result = buildStockPatch(changedItems, skuIndex);

    expect(result.skippedDeleted).toEqual(['YY88888']);
    expect(result.patchItems).toHaveLength(1);
  });

  it('skips items without a matching SKU', () => {
    const changedItems: StockChangeItem[] = [
      { ...buildItem('UNKNOWN', 5), new: true },
      { ...buildItem('AN03027', 10) },
    ];

    const result = buildStockPatch(changedItems, skuIndex);

    expect(result.skippedNoSku).toEqual(['UNKNOWN']);
    expect(result.patchItems).toEqual([
      {
        id: 300400016,
        variants: [
          {
            id: 1339400000,
            inventory_levels: [{ stock: 10 }],
          },
        ],
      },
    ]);
  });
});

describe('chunkPatchItems', () => {
  it('splits patch items by max variants per chunk', () => {
    const patchItems = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      variants: [{ id: index + 100, inventory_levels: [{ stock: index }] }],
    }));

    expect(chunkPatchItems(patchItems, 2)).toEqual([
      patchItems.slice(0, 2),
      patchItems.slice(2, 4),
      patchItems.slice(4, 5),
    ]);
  });

  it('starts a new chunk when variants would exceed the limit', () => {
    const patchItems = Array.from({ length: 51 }, (_, index) => ({
      id: index + 1,
      variants: [{ id: index + 100, inventory_levels: [{ stock: index }] }],
    }));

    const chunks = chunkPatchItems(patchItems, 50);

    expect(chunks).toHaveLength(2);
    expect(countPatchVariants(chunks[0] ?? [])).toBe(50);
    expect(countPatchVariants(chunks[1] ?? [])).toBe(1);
  });
});
