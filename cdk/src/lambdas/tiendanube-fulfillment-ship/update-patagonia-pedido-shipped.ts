import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import {
  buildPatagoniaPedidoPk,
  type PatagoniaPedidoFulfillmentStatus,
} from '../../shared/patagonia-pedidos.types';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export interface UpdatePatagoniaPedidoShippedInput {
  tableName: string;
  digipCodigo: string;
  fulfillmentStatus: PatagoniaPedidoFulfillmentStatus;
  shippedAt: string;
  tiendanubeFulfillmentIds: string[];
  digipCompletoAt?: string;
}

/**
 * Updates a Patagonia pedido record with Tiendanube fulfillment shipped fields.
 */
export async function updatePatagoniaPedidoShipped(
  input: UpdatePatagoniaPedidoShippedInput,
): Promise<boolean> {
  const expressionParts = [
    'fulfillmentStatus = :fulfillmentStatus',
    'shippedAt = :shippedAt',
    'tiendanubeFulfillmentIds = :tiendanubeFulfillmentIds',
  ];
  const values: Record<string, unknown> = {
    ':fulfillmentStatus': input.fulfillmentStatus,
    ':shippedAt': input.shippedAt,
    ':tiendanubeFulfillmentIds': input.tiendanubeFulfillmentIds,
  };

  if (input.digipCompletoAt) {
    expressionParts.push('digipCompletoAt = :digipCompletoAt');
    values[':digipCompletoAt'] = input.digipCompletoAt;
  }

  const response = await documentClient.send(
    new UpdateCommand({
      TableName: input.tableName,
      Key: { pk: buildPatagoniaPedidoPk(input.digipCodigo) },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeValues: values,
      ConditionExpression: 'attribute_exists(pk)',
      ReturnValues: 'ALL_NEW',
    }),
  );

  return Boolean(response.Attributes);
}
