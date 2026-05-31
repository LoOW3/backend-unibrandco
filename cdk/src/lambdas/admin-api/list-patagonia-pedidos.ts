import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { PATAGONIA_PEDIDO_RECORD_TYPE } from '../../shared/patagonia-pedidos.types';
import type { PatagoniaPedidoListItem } from '../../shared/patagonia-pedidos.types';
import { resolvePatagoniaPedidoStatus } from '../../shared/resolve-patagonia-pedido-status';
import { decodeCursor, encodeCursor, parseLimit } from './pagination';
import type { AdminApiEnv, PaginatedPatagoniaPedidosResponse } from './types';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function toListItem(item: Record<string, unknown>): PatagoniaPedidoListItem {
  const listItem: PatagoniaPedidoListItem = {
    codigo: String(item.codigo),
    tiendanubeOrderId: Number(item.tiendanubeOrderId),
    createdAt: String(item.createdAt),
    itemCount: Number(item.itemCount),
    status: resolvePatagoniaPedidoStatus({
      fulfillmentStatus:
        typeof item.fulfillmentStatus === 'string'
          ? item.fulfillmentStatus
          : undefined,
    }),
  };

  if (item.fulfillmentStatus === 'DISPATCHED') {
    listItem.fulfillmentStatus = 'DISPATCHED';
  }

  if (typeof item.shippedAt === 'string') {
    listItem.shippedAt = item.shippedAt;
  }

  return listItem;
}

/**
 * Lists Patagonia pedido records with pagination (newest first).
 */
export async function listPatagoniaPedidos(
  env: AdminApiEnv,
  queryParams: Record<string, string | undefined>,
): Promise<PaginatedPatagoniaPedidosResponse> {
  const limit = parseLimit(queryParams.limit);
  const exclusiveStartKey = decodeCursor(queryParams.cursor);

  const response = await documentClient.send(
    new QueryCommand({
      TableName: env.PATAGONIA_PEDIDOS_TABLE_NAME,
      IndexName: env.PATAGONIA_PEDIDOS_GSI_NAME,
      KeyConditionExpression: 'recordType = :recordType',
      ExpressionAttributeValues: {
        ':recordType': PATAGONIA_PEDIDO_RECORD_TYPE,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
      ProjectionExpression:
        'codigo, tiendanubeOrderId, createdAt, itemCount, fulfillmentStatus, shippedAt',
    }),
  );

  const items = (response.Items ?? []).map((item) =>
    toListItem(item as Record<string, unknown>),
  );

  return {
    items,
    nextCursor: encodeCursor(
      response.LastEvaluatedKey as Record<string, unknown> | undefined,
    ),
  };
}
