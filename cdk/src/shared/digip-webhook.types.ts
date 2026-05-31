/** DigipWMS webhook event types (POST /api/v2/WebHooks). */
export type DigipWebhookEventType = 'Pedido_Completo' | 'Pedido_Creado';

export const DIGIP_PEDIDO_COMPLETO_EVENT = 'Pedido_Completo' as const;

/** DigipWMS Pedido_Completo payload data section. */
export interface DigipPedidoCompletoData {
  Codigo: string;
  Estado?: string;
  Fecha?: string;
  FechaHoraEstado?: string;
}

/** Full Pedido_Completo webhook body from DigipWMS. */
export interface DigipPedidoCompletoWebhookBody {
  eventId?: number;
  event?: string;
  eventAt?: string;
  data: DigipPedidoCompletoData;
}

/** Parsed DigipWMS webhook callback body (shape may vary; fields optional). */
export interface DigipWebhookBody {
  eventType?: string;
  eventId?: number;
  event?: string;
  eventAt?: string;
  data?: DigipPedidoCompletoData;
  [key: string]: unknown;
}

/** Result of parsing an incoming Digip webhook HTTP body. */
export interface ParsedDigipWebhookBody {
  body: DigipWebhookBody | string;
  parseWarning?: string;
}
