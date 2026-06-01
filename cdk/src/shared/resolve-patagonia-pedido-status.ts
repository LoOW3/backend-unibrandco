/** Admin API / UI status derived from fulfillment fields (not stored in DynamoDB). */
export type PatagoniaPedidoStatus = 'pending' | 'shipped';

export interface PatagoniaPedidoStatusInput {
  fulfillmentStatus?: string;
}

/**
 * Derives list/detail status from stored fulfillment state.
 */
export function resolvePatagoniaPedidoStatus(
  input: PatagoniaPedidoStatusInput,
): PatagoniaPedidoStatus {
  if (
    input.fulfillmentStatus === 'PACKED' ||
    input.fulfillmentStatus === 'DISPATCHED'
  ) {
    return 'shipped';
  }

  return 'pending';
}
