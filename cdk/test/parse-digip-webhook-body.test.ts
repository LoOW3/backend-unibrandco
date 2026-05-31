import {
  getEventTypeFromBody,
  parseWebhookBody,
} from '../src/lambdas/digip-pedido-completo-webhook/parse-webhook-body';

describe('parseWebhookBody', () => {
  it('parses valid JSON object', () => {
    const result = parseWebhookBody(
      JSON.stringify({ eventType: 'Pedido_Completo', codigo: '1983713089TN' }),
    );

    expect(result.parseWarning).toBeUndefined();
    expect(result.body).toEqual({
      eventType: 'Pedido_Completo',
      codigo: '1983713089TN',
    });
  });

  it('returns warning for empty body', () => {
    const result = parseWebhookBody('   ');

    expect(result.parseWarning).toBe('Empty webhook body');
    expect(result.body).toBe('');
  });

  it('returns raw string when body is not JSON', () => {
    const result = parseWebhookBody('not-json');

    expect(result.parseWarning).toBe('Webhook body is not valid JSON');
    expect(result.body).toBe('not-json');
  });

  it('returns warning when JSON is not an object', () => {
    const result = parseWebhookBody('["array"]');

    expect(result.parseWarning).toBe('Webhook body is not a JSON object');
    expect(result.body).toBe('["array"]');
  });
});

describe('getEventTypeFromBody', () => {
  it('reads eventType from object body', () => {
    expect(getEventTypeFromBody({ eventType: 'Pedido_Creado' })).toBe('Pedido_Creado');
  });

  it('returns undefined for string body', () => {
    expect(getEventTypeFromBody('raw')).toBeUndefined();
  });
});
