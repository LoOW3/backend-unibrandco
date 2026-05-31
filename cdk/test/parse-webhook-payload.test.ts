import {
  ORDER_PAID_EVENT,
  parseWebhookPayload,
  WebhookPayloadError,
} from '../src/lambdas/tiendanube-order-paid-webhook/parse-webhook-payload';

describe('parseWebhookPayload', () => {
  it('parses a valid order/paid payload', () => {
    const payload = parseWebhookPayload(
      JSON.stringify({
        store_id: 817495,
        event: ORDER_PAID_EVENT,
        id: 871254203,
      }),
    );

    expect(payload).toEqual({
      store_id: 817495,
      event: ORDER_PAID_EVENT,
      id: 871254203,
    });
  });

  it('accepts string numeric ids', () => {
    const payload = parseWebhookPayload(
      JSON.stringify({
        store_id: '817495',
        event: ORDER_PAID_EVENT,
        id: '871254203',
      }),
    );

    expect(payload.store_id).toBe(817495);
    expect(payload.id).toBe(871254203);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseWebhookPayload('not-json')).toThrow(WebhookPayloadError);
  });

  it('rejects missing event', () => {
    expect(() =>
      parseWebhookPayload(JSON.stringify({ store_id: 1, id: 2 })),
    ).toThrow(WebhookPayloadError);
  });
});
