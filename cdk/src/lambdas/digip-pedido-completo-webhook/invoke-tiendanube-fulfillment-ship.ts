import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

import type { TiendanubeFulfillmentShipEvent } from '../../shared/tiendanube-fulfillment-ship.types';

/**
 * Asynchronously invokes the Tiendanube fulfillment ship Lambda.
 */
export async function invokeTiendanubeFulfillmentShip(
  functionName: string,
  payload: TiendanubeFulfillmentShipEvent,
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
