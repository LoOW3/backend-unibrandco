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
