import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';

import { extractDigipPedidoCodigo } from '../../shared/extract-digip-pedido-codigo';
import { DIGIP_PEDIDO_COMPLETO_EVENT } from '../../shared/digip-webhook.types';
import {
  parseTiendanubeOrderIdFromDigipCodigo,
  ParseDigipCodigoError,
} from '../../shared/parse-digip-codigo';
import { jsonResponse } from '../admin-api/http-response';

import { filterHeadersForLog } from './filter-headers';
import { invokeTiendanubeFulfillmentShip } from './invoke-tiendanube-fulfillment-ship';
import { getEventTypeFromBody, parseWebhookBody } from './parse-webhook-body';
import type { DigipPedidoCompletoWebhookEnv } from './types';

function getEnv(): DigipPedidoCompletoWebhookEnv {
  const shipFunctionName = process.env.TIENDANUBE_FULFILLMENT_SHIP_FUNCTION_NAME;

  if (!shipFunctionName) {
    throw new Error('Missing required environment variables for Digip pedido completo webhook');
  }

  return {
    TIENDANUBE_FULFILLMENT_SHIP_FUNCTION_NAME: shipFunctionName,
  };
}

function decodeRequestBody(event: APIGatewayProxyEventV2): string {
  if (event.isBase64Encoded) {
    return Buffer.from(event.body ?? '', 'base64').toString('utf8');
  }

  return event.body ?? '';
}

function getDigipCompletoAt(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const eventAt = (body as Record<string, unknown>).eventAt;

  return typeof eventAt === 'string' ? eventAt : undefined;
}

/**
 * Lambda handler for DigipWMS Pedido_Completo webhooks (logs payload and triggers Tiendanube ship).
 */
export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context,
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;

  if (method !== 'POST') {
    return jsonResponse(405, { message: 'Method not allowed' });
  }

  try {
    const env = getEnv();
    const rawBody = decodeRequestBody(event);
    const parsed = parseWebhookBody(rawBody);
    const eventType = getEventTypeFromBody(parsed.body);
    const headers = filterHeadersForLog(event.headers);

    if (parsed.parseWarning) {
      console.warn(
        JSON.stringify({
          action: 'digip webhook parse warning',
          warning: parsed.parseWarning,
          headers,
          body: parsed.body,
        }),
      );
    }

    if (eventType && eventType !== DIGIP_PEDIDO_COMPLETO_EVENT) {
      console.log(
        JSON.stringify({
          action: 'digip webhook skipped',
          eventType,
          expectedEventType: DIGIP_PEDIDO_COMPLETO_EVENT,
          headers,
          body: parsed.body,
        }),
      );

      return jsonResponse(200, { received: true, skipped: true });
    }

    console.log(
      JSON.stringify({
        action: 'digip webhook received',
        eventType: eventType ?? DIGIP_PEDIDO_COMPLETO_EVENT,
        headers,
        body: parsed.body,
      }),
    );

    const digipCodigo = extractDigipPedidoCodigo(parsed.body);

    if (digipCodigo) {
      try {
        const tiendanubeOrderId = parseTiendanubeOrderIdFromDigipCodigo(digipCodigo);

        await invokeTiendanubeFulfillmentShip(env.TIENDANUBE_FULFILLMENT_SHIP_FUNCTION_NAME, {
          tiendanubeOrderId,
          digipCodigo,
          digipCompletoAt: getDigipCompletoAt(parsed.body),
        });
      } catch (error) {
        const message =
          error instanceof ParseDigipCodigoError || error instanceof Error
            ? error.message
            : 'Unknown error';

        console.error(
          JSON.stringify({
            action: 'digip webhook invoke ship failed',
            digipCodigo,
            message,
          }),
        );
      }
    } else {
      console.warn(
        JSON.stringify({
          action: 'digip webhook missing codigo',
          body: parsed.body,
        }),
      );
    }

    return jsonResponse(200, { received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ action: 'digip webhook failed', message }));
    return jsonResponse(500, { message });
  }
}
