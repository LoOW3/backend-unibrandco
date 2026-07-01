import type {
  ProductsCleanProduct,
  ProductsCleanVariant,
} from '../../shared/tiendanube.types';

/** Full Tiendanube product export payload (only the fields we read). */
export interface RawProductsExport {
  fetched_at?: string;
  products: RawProduct[];
}

interface RawInventoryLevel {
  id: number;
  variant_id: number;
  stock: number;
}

interface RawVariant {
  id: number;
  product_id: number;
  stock: number;
  sku: string;
  inventory_levels?: RawInventoryLevel[] | null;
}

interface RawProduct {
  id: number;
  variants?: RawVariant[] | null;
}

function cleanInventoryLevel(level: RawInventoryLevel) {
  return {
    id: level.id,
    variant_id: level.variant_id,
    stock: level.stock,
  };
}

function cleanVariant(variant: RawVariant): ProductsCleanVariant {
  const inventoryLevels = variant.inventory_levels ?? [];
  return {
    id: variant.id,
    product_id: variant.product_id,
    stock: variant.stock,
    sku: variant.sku,
    inventory_levels: inventoryLevels.map(cleanInventoryLevel),
  };
}

function cleanProduct(product: RawProduct): ProductsCleanProduct {
  const variants = product.variants ?? [];
  return {
    id: product.id,
    variants: variants.map(cleanVariant),
  };
}

/**
 * Minimizes a full products export into stock-focused entries.
 * Mirrors scripts/clean_tiendanube_products.py.
 */
export function cleanProducts(products: RawProduct[]): ProductsCleanProduct[] {
  return products.map(cleanProduct);
}
