import { fetchTiendanubeOrder } from '../../shared/fetch-tiendanube-order';
import { getTiendanubeConfig } from '../../shared/get-tiendanube-config';
import { toOrderProductsSummary } from '../../shared/to-order-products-summary';
import {
  TIENDANUBE_ORDER_PRODUCTS_SUMMARY_ACTION,
  type TiendanubeOrderProductsSummaryEvent,
  type TiendanubeWebhookPayload,
} from '../../shared/tiendanube.types';

import { invokePatagoniaCreatePedido } from './invoke-patagonia-create-pedido';
import { ORDER_PAID_EVENT } from './parse-webhook-payload';
import type { TiendanubeOrderPaidWebhookEnv } from './types';

/**
 * Handles order/paid webhooks: fetches order, logs, invokes Patagonia Lambda, returns summary payload.
 */
export async function processOrderPaid(
  env: TiendanubeOrderPaidWebhookEnv,
  payload: TiendanubeWebhookPayload,
): Promise<TiendanubeOrderProductsSummaryEvent | null> {
  if (payload.event !== ORDER_PAID_EVENT) {
    console.log(
      JSON.stringify({
        action: 'tiendanube webhook skipped',
        event: payload.event,
        orderId: payload.id,
      }),
    );
    return null;
  }

  const config = await getTiendanubeConfig(env.TIENDANUBE_SECRET_ARN);

  if (String(payload.store_id) !== config.store_id) {
    console.warn(
      JSON.stringify({
        action: 'tiendanube webhook store_id mismatch',
        payloadStoreId: payload.store_id,
        configStoreId: config.store_id,
        orderId: payload.id,
      }),
    );
  }

  const order = await fetchTiendanubeOrder(
    config,
    env.TIENDANUBE_API_VERSION,
    payload.id,
  );

  const summary = toOrderProductsSummary(order);
  const logPayload: TiendanubeOrderProductsSummaryEvent = {
    action: TIENDANUBE_ORDER_PRODUCTS_SUMMARY_ACTION,
    summary,
  };

  console.log(JSON.stringify({ action: 'tiendanube order fetched', order }));
  console.log(JSON.stringify(logPayload));

  await invokePatagoniaCreatePedido(
    env.PATAGONIA_CREATE_PEDIDO_FUNCTION_NAME,
    logPayload,
  );

  return logPayload;
}
