/** Payload from Digip webhook Lambda to tiendanube-fulfillment-ship Lambda. */
export interface TiendanubeFulfillmentShipEvent {
  tiendanubeOrderId: number;
  digipCodigo: string;
  digipCompletoAt?: string;
}
