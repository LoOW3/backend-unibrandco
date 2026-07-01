import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';

import { jsonResponse } from '../admin-api/http-response';

import { parseWebhookPayload, WebhookPayloadError } from './parse-webhook-payload';
import { processOrderPaid } from './process-order-paid';
import type { TiendanubeOrderPaidWebhookEnv } from './types';

function getEnv(): TiendanubeOrderPaidWebhookEnv {
  const apiVersion = process.env.TIENDANUBE_API_VERSION ?? '2025-03';
  const patagoniaFunctionName = process.env.PATAGONIA_CREATE_PEDIDO_FUNCTION_NAME;

  if (!patagoniaFunctionName) {
    throw new Error('Missing required environment variables for Tiendanube order paid webhook');
  }

  return {
    TIENDANUBE_API_VERSION: apiVersion,
    PATAGONIA_CREATE_PEDIDO_FUNCTION_NAME: patagoniaFunctionName,
  };
}

/**
 * Lambda handler for Tiendanube order/paid webhooks.
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
    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : (event.body ?? '');

    const payload = parseWebhookPayload(body);
    const logPayload = await processOrderPaid(env, payload);

    if (logPayload) {
      return jsonResponse(200, logPayload);
    }

    return jsonResponse(200, { received: true, skipped: true });
  } catch (error) {
    if (error instanceof WebhookPayloadError) {
      return jsonResponse(400, { message: error.message });
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ action: 'tiendanube webhook failed', message }));
    return jsonResponse(500, { message });
  }
}
