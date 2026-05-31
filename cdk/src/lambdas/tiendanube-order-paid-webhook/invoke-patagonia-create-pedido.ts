import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

import type { TiendanubeOrderProductsSummaryEvent } from '../../shared/tiendanube.types';

/**
 * Asynchronously invokes the Patagonia create-pedido Lambda with the summary payload.
 */
export async function invokePatagoniaCreatePedido(
  functionName: string,
  payload: TiendanubeOrderProductsSummaryEvent,
): Promise<void> {
  const client = new LambdaClient({});

  await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );
}
