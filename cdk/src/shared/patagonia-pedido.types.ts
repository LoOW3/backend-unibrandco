/** DigipWMS CreatePedido item (POST /api/v2/Pedidos). */
export interface PatagoniaCreatePedidoItem {
  linea: string;
  articuloCodigo: string;
  unidades: number;
}

/** DigipWMS CreatePedido body (POST /api/v2/Pedidos). */
export interface PatagoniaCreatePedido {
  codigo: string;
  clienteUbicacionCodigo: string;
  fecha: string;
  estado: 'Pendiente' | 'PendienteGestion';
  observacion?: string | null;
  items: PatagoniaCreatePedidoItem[];
}
