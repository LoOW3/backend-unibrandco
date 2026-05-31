/** Slim variant entry from products-clean.json in S3. */
export interface ProductsCleanVariant {
  id: number;
  product_id: number;
  stock: number;
  sku: string;
  inventory_levels: Array<{
    id: number;
    variant_id: number;
    stock: number;
  }>;
}

/** Slim product entry from products-clean.json in S3. */
export interface ProductsCleanProduct {
  id: number;
  variants: ProductsCleanVariant[];
}

/** products-clean.json export stored in S3. */
export interface ProductsCleanExport {
  source?: string;
  source_fetched_at?: string;
  generated_at?: string;
  total_count: number;
  products: ProductsCleanProduct[];
}

/** Maps Patagonia CodigoArticulo to Tiendanube product and variant IDs. */
export interface SkuMapping {
  productId: number;
  variantId: number;
}

/** Tiendanube stock-price PATCH payload item. */
export interface TiendanubeStockPatchItem {
  id: number;
  variants: Array<{
    id: number;
    inventory_levels: Array<{
      stock: number;
    }>;
  }>;
}

/** Tiendanube API credentials stored in Secrets Manager. */
export interface TiendanubeConfig {
  store_id: string;
  access_token: string;
  user_agent: string;
}

/** Payload sent by Tiendanube order webhooks. */
export interface TiendanubeWebhookPayload {
  store_id: number;
  event: string;
  id: number;
}

/** Line item on a Tiendanube order (subset used by this service). */
export interface TiendanubeOrderProduct {
  id: number;
  variant_id: string | number;
  quantity: string | number;
  sku: string | null;
}

/** Contact and billing fields on a Tiendanube order. */
export interface TiendanubeOrderContactAndBilling {
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  billing_name?: string;
  billing_phone?: string;
  billing_address?: string;
  billing_number?: string;
  billing_floor?: string;
  billing_locality?: string;
  billing_zipcode?: string;
  billing_city?: string;
  billing_province?: string;
  billing_country?: string;
}

/** Tiendanube fulfillment order status values used by PATCH. */
export type TiendanubeFulfillmentOrderStatus =
  | 'UNPACKED'
  | 'PACKED'
  | 'DISPATCHED'
  | 'READY_FOR_PICKUP'
  | 'DELIVERED';

/** Tiendanube fulfillment order (subset used by this service). */
export interface TiendanubeFulfillmentOrder {
  id: string;
  status?: TiendanubeFulfillmentOrderStatus;
}

/** Tiendanube order resource (subset used by this service). */
export interface TiendanubeOrder extends TiendanubeOrderContactAndBilling {
  id: number;
  products: TiendanubeOrderProduct[];
  fulfillments?: string[];
  [key: string]: unknown;
}

/** Formatted customer data for order/paid summary logs. */
export interface OrderUserData {
  name: string;
  phone: string;
  email: string;
  address: string;
}

/** Slim order payload logged after order/paid. */
export interface OrderProductsSummary {
  id: number;
  products: Array<{
    id: number;
    variant_id: string | number;
    quantity: string | number;
    sku: string | null;
  }>;
  userData: OrderUserData;
}

/** Action label for the order/paid summary log and Patagonia invoke payload. */
export const TIENDANUBE_ORDER_PRODUCTS_SUMMARY_ACTION =
  'tiendanube order products summary' as const;

/** Payload passed from the webhook Lambda to Patagonia create-pedido Lambda. */
export interface TiendanubeOrderProductsSummaryEvent {
  action: typeof TIENDANUBE_ORDER_PRODUCTS_SUMMARY_ACTION;
  summary: OrderProductsSummary;
}
