import type { DigipPedidoCompletoWebhookBody, DigipWebhookBody } from './digip-webhook.types';

function isPedidoCompletoData(value: unknown): value is DigipPedidoCompletoWebhookBody['data'] {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.Codigo === 'string' && record.Codigo.length > 0;
}

/**
 * Extracts Digip pedido Codigo from a parsed Pedido_Completo webhook body.
 */
export function extractDigipPedidoCodigo(body: DigipWebhookBody | string): string | null {
  if (typeof body === 'string') {
    return null;
  }

  const data = body.data;

  if (!isPedidoCompletoData(data)) {
    return null;
  }

  return data.Codigo;
}
