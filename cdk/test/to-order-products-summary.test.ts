import { toOrderProductsSummary } from '../src/shared/to-order-products-summary';
import type { TiendanubeOrder } from '../src/shared/tiendanube.types';

describe('toOrderProductsSummary', () => {
  it('maps order products and userData to the slim summary shape', () => {
    const order: TiendanubeOrder = {
      id: 871254203,
      contact_name: 'Maria Silva',
      contact_phone: '+551533276436',
      contact_email: 'buyer@tiendanube.com',
      billing_name: 'fernando',
      billing_phone: '',
      billing_address: 'zuviria',
      billing_number: '991',
      billing_floor: 'b',
      billing_locality: 'parque chacabuco',
      billing_zipcode: '1424',
      billing_city: 'caba',
      billing_province: 'Capital Federal',
      billing_country: 'AR',
      products: [
        {
          id: 1069053829,
          variant_id: '426215948',
          quantity: '1',
          sku: '12389012348124801234890',
        },
      ],
    };

    expect(toOrderProductsSummary(order)).toEqual({
      id: 871254203,
      products: [
        {
          id: 1069053829,
          variant_id: '426215948',
          quantity: '1',
          sku: '12389012348124801234890',
        },
      ],
      userData: {
        name: 'Maria Silva',
        phone: '+551533276436',
        email: 'buyer@tiendanube.com',
        address:
          'fernando, zuviria 991, b, parque chacabuco, 1424, caba, Capital Federal, AR',
      },
    });
  });
});
