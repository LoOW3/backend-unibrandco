import type { PatagoniaStockItem } from '../src/shared/patagonia-stock.types';
import { compareStockSnapshots } from '../src/lambdas/stock-diff/compare-stock';

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

describe('compareStockSnapshots', () => {
  it('includes changed items with previousUnidadesDisponibles', () => {
    const previous = [buildItem('AN03027', 4)];
    const current = [buildItem('AN03027', 10)];

    const result = compareStockSnapshots(current, previous);

    expect(result).toEqual([
      {
        ...current[0],
        previousUnidadesDisponibles: 4,
      },
    ]);
  });

  it('marks new items with new: true', () => {
    const previous = [buildItem('AN03027', 4)];
    const current = [buildItem('AN03027', 4), buildItem('XX99999', 5)];

    const result = compareStockSnapshots(current, previous);

    expect(result).toEqual([{ ...current[1], new: true }]);
  });

  it('marks deleted items with deleted: true using previous snapshot data', () => {
    const previous = [buildItem('AN03027', 4), buildItem('YY88888', 2)];
    const current = [buildItem('AN03027', 4)];

    const result = compareStockSnapshots(current, previous);

    expect(result).toEqual([{ ...previous[1], deleted: true }]);
  });

  it('returns empty array when UnidadesDisponibles did not change', () => {
    const previous = [buildItem('AN03027', 4), buildItem('CH06002', 10)];
    const current = [buildItem('AN03027', 4), buildItem('CH06002', 10)];

    expect(compareStockSnapshots(current, previous)).toEqual([]);
  });
});
