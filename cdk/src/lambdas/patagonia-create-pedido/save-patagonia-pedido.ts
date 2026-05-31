import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

import type { PatagoniaCreatePedido } from '../../shared/patagonia-pedido.types';
import type { OrderProductsSummary } from '../../shared/tiendanube.types';

import { buildPatagoniaPedidoRecord } from './build-patagonia-pedido-record';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export interface SavePatagoniaPedidoInput {
  tableName: string;
  summary: OrderProductsSummary;
  createPedido: PatagoniaCreatePedido;
  createdAt?: Date;
}

/**
 * Persists a successfully created Patagonia pedido to DynamoDB.
 */
export async function savePatagoniaPedido(input: SavePatagoniaPedidoInput): Promise<void> {
  const record = buildPatagoniaPedidoRecord(
    input.summary,
    input.createPedido,
    input.createdAt,
  );

  await documentClient.send(
    new PutCommand({
      TableName: input.tableName,
      Item: record,
    }),
  );
}
