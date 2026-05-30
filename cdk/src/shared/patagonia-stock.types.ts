/** Single stock item returned by Patagonia WMS API. */
export interface PatagoniaStockItem {
  CodigoArticulo: string;
  UnidadesDisponibles: number;
  UnidadesReservadas: number;
  UnidadesBloqueadas: number;
  UnidadesADespachar: number;
  UnidadesEnRecepcion: number;
  UnidadesTransitoInterno: number;
  UnidadesVencidas: number;
  UnidadesPedidas: number;
}

/** Stock item included in a diff record with optional change metadata. */
export interface StockChangeItem extends PatagoniaStockItem {
  previousUnidadesDisponibles?: number;
  new?: true;
  deleted?: true;
}
