import { formatOrderBillingAddress } from './format-order-billing-address';
import type { OrderUserData, TiendanubeOrder } from './tiendanube.types';

/**
 * Builds formatted customer data from order contact and billing fields.
 */
export function toOrderUserData(order: TiendanubeOrder): OrderUserData {
  return {
    name: order.contact_name?.trim() ?? '',
    phone: order.contact_phone?.trim() ?? '',
    email: order.contact_email?.trim() ?? '',
    address: formatOrderBillingAddress(order),
  };
}
