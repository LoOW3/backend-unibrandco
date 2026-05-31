import { toOrderUserData } from './to-order-user-data';
import type { OrderProductsSummary, TiendanubeOrder } from './tiendanube.types';

/**
 * Builds a slim order payload with product line items and user data for logging.
 */
export function toOrderProductsSummary(order: TiendanubeOrder): OrderProductsSummary {
  return {
    id: order.id,
    products: order.products.map((product) => ({
      id: product.id,
      variant_id: product.variant_id,
      quantity: product.quantity,
      sku: product.sku,
    })),
    userData: toOrderUserData(order),
  };
}
