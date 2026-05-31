import { buildPatchedItems } from '../src/lambdas/tiendanube-stock-sync/build-patched-items';
import type { StockChangeItem } from '../src/shared/patagonia-stock.types';
import type { SkuMapping } from '../src/shared/tiendanube.types';

describe('buildPatchedItems', () => {
  const skuIndex = new Map<string, SkuMapping>([
    ['SKU-1', { productId: 1, variantId: 10 }],
    ['SKU-2', { productId: 2, variantId: 20 }],
  ]);

  it('includes mapped non-deleted items with stock values', () => {
    const changedItems: StockChangeItem[] = [
      {
        CodigoArticulo: 'SKU-1',
        UnidadesDisponibles: 12,
        previousUnidadesDisponibles: 8,
        UnidadesReservadas: 0,
        UnidadesBloqueadas: 0,
        UnidadesADespachar: 0,
        UnidadesEnRecepcion: 0,
        UnidadesTransitoInterno: 0,
        UnidadesVencidas: 0,
        UnidadesPedidas: 0,
      },
    ];

    expect(buildPatchedItems(changedItems, skuIndex)).toEqual([
      {
        sku: 'SKU-1',
        newStock: 12,
        previousStock: 8,
      },
    ]);
  });

  it('skips deleted items and unknown skus', () => {
    const changedItems: StockChangeItem[] = [
      {
        CodigoArticulo: 'SKU-1',
        UnidadesDisponibles: 5,
        deleted: true,
        UnidadesReservadas: 0,
        UnidadesBloqueadas: 0,
        UnidadesADespachar: 0,
        UnidadesEnRecepcion: 0,
        UnidadesTransitoInterno: 0,
        UnidadesVencidas: 0,
        UnidadesPedidas: 0,
      },
      {
        CodigoArticulo: 'SKU-UNKNOWN',
        UnidadesDisponibles: 3,
        UnidadesReservadas: 0,
        UnidadesBloqueadas: 0,
        UnidadesADespachar: 0,
        UnidadesEnRecepcion: 0,
        UnidadesTransitoInterno: 0,
        UnidadesVencidas: 0,
        UnidadesPedidas: 0,
      },
    ];

    expect(buildPatchedItems(changedItems, skuIndex)).toEqual([]);
  });
});
