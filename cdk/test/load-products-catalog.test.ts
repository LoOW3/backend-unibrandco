import { buildSkuIndex } from '../src/lambdas/tiendanube-stock-sync/load-products-catalog';
import type { ProductsCleanProduct } from '../src/shared/tiendanube.types';

describe('buildSkuIndex', () => {
  it('maps variant sku to product and variant ids', () => {
    const products: ProductsCleanProduct[] = [
      {
        id: 300367037,
        variants: [
          {
            id: 1339341913,
            product_id: 300367037,
            stock: 36,
            sku: 'SS03006',
            inventory_levels: [],
          },
        ],
      },
    ];

    const skuIndex = buildSkuIndex(products);

    expect(skuIndex.get('SS03006')).toEqual({
      productId: 300367037,
      variantId: 1339341913,
    });
  });
});
