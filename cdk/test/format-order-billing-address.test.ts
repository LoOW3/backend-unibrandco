import { formatOrderBillingAddress } from '../src/shared/format-order-billing-address';
import type { TiendanubeOrder } from '../src/shared/tiendanube.types';

describe('formatOrderBillingAddress', () => {
  it('joins billing fields and omits empty billing_phone', () => {
    const order: TiendanubeOrder = {
      id: 1,
      products: [],
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
    };

    expect(formatOrderBillingAddress(order)).toBe(
      'fernando, zuviria 991, b, parque chacabuco, 1424, caba, Capital Federal, AR',
    );
  });

  it('includes billing_phone when present', () => {
    const order: TiendanubeOrder = {
      id: 1,
      products: [],
      billing_name: 'fernando',
      billing_phone: '+541112345678',
      billing_address: 'zuviria',
      billing_number: '991',
    };

    expect(formatOrderBillingAddress(order)).toBe(
      'fernando, +541112345678, zuviria 991',
    );
  });
});
