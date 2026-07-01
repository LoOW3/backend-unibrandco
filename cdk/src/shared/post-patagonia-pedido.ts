import { getPatagoniaApiKey } from './get-patagonia-api-key';
import type { PatagoniaCreatePedido } from './patagonia-pedido.types';

/**
 * Creates a pedido in DigipWMS via POST /api/v2/Pedidos.
 */
export async function postPatagoniaPedido(
  apiUrl: string,
  body: PatagoniaCreatePedido,
): Promise<void> {
  const apiKey = getPatagoniaApiKey();

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Patagonia Pedidos POST failed: ${response.status} ${response.statusText} - ${errorBody.slice(0, 500)}`,
    );
  }
}
