import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type {
  ProductsCleanExport,
  SkuMapping,
} from '../../shared/tiendanube.types';

export interface ProductsCatalog {
  skuIndex: Map<string, SkuMapping>;
  totalProducts: number;
}

/**
 * Builds a SKU index from products-clean.json products.
 */
export function buildSkuIndex(
  products: ProductsCleanExport['products'],
): Map<string, SkuMapping> {
  const skuIndex = new Map<string, SkuMapping>();

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      if (!variant.sku) {
        continue;
      }

      skuIndex.set(variant.sku, {
        productId: product.id,
        variantId: variant.id,
      });
    }
  }

  return skuIndex;
}

/**
 * Loads products-clean.json from S3 and builds a SKU lookup index.
 */
export async function loadProductsCatalog(
  bucketName: string,
  objectKey: string,
): Promise<ProductsCatalog> {
  const s3Client = new S3Client({});
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error(`Empty S3 object: s3://${bucketName}/${objectKey}`);
  }

  const body = await response.Body.transformToString('utf-8');
  const payload = JSON.parse(body) as ProductsCleanExport;

  if (!Array.isArray(payload.products)) {
    throw new Error('products-clean.json must contain a products array');
  }

  return {
    skuIndex: buildSkuIndex(payload.products),
    totalProducts: payload.products.length,
  };
}
