import type { TiendanubeWebhookPayload } from '../../shared/tiendanube.types';

const ORDER_PAID_EVENT = 'order/paid';

export class WebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookPayloadError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw new WebhookPayloadError(`Invalid or missing ${fieldName}`);
}

/**
 * Parses and validates a Tiendanube webhook JSON body.
 */
export function parseWebhookPayload(body: string): TiendanubeWebhookPayload {
  if (!body.trim()) {
    throw new WebhookPayloadError('Empty webhook body');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw new WebhookPayloadError('Webhook body is not valid JSON');
  }

  if (!isRecord(parsed)) {
    throw new WebhookPayloadError('Webhook body must be a JSON object');
  }

  const event = parsed.event;

  if (typeof event !== 'string' || !event.trim()) {
    throw new WebhookPayloadError('Invalid or missing event');
  }

  return {
    store_id: parsePositiveInteger(parsed.store_id, 'store_id'),
    event: event.trim(),
    id: parsePositiveInteger(parsed.id, 'id'),
  };
}

export { ORDER_PAID_EVENT };
