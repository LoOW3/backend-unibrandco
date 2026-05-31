import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

import {
  buildPatagoniaPedidoPk,
  type PatagoniaPedidoRecord,
} from '../../shared/patagonia-pedidos.types';
import type { AdminApiEnv } from './types';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Returns a full Patagonia pedido record by DigipWMS codigo.
 */
export async function getPatagoniaPedido(
  env: AdminApiEnv,
  codigo: string,
): Promise<PatagoniaPedidoRecord | null> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: env.PATAGONIA_PEDIDOS_TABLE_NAME,
      Key: { pk: buildPatagoniaPedidoPk(codigo) },
    }),
  );

  if (!response.Item) {
    return null;
  }

  return response.Item as PatagoniaPedidoRecord;
}
