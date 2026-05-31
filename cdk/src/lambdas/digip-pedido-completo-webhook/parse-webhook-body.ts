import type { DigipWebhookBody, ParsedDigipWebhookBody } from '../../shared/digip-webhook.types';

/**
 * Parses DigipWMS webhook callback body. Returns raw string if JSON is invalid.
 */
export function parseWebhookBody(rawBody: string): ParsedDigipWebhookBody {
  if (!rawBody.trim()) {
    return {
      body: '',
      parseWarning: 'Empty webhook body',
    };
  }

  try {
    const parsed = JSON.parse(rawBody) as unknown;

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        body: rawBody,
        parseWarning: 'Webhook body is not a JSON object',
      };
    }

    return { body: parsed as DigipWebhookBody };
  } catch {
    return {
      body: rawBody,
      parseWarning: 'Webhook body is not valid JSON',
    };
  }
}

/**
 * Reads eventType from a parsed Digip webhook body when present.
 */
export function getEventTypeFromBody(
  body: DigipWebhookBody | string,
): string | undefined {
  if (typeof body === 'string') {
    return undefined;
  }

  const eventType = body.eventType;

  return typeof eventType === 'string' ? eventType : undefined;
}
