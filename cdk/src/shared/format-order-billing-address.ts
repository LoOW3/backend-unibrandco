import type { TiendanubeOrder } from './tiendanube.types';

function normalizePart(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function joinStreetLine(address: string | undefined, number: string | undefined): string | undefined {
  const street = normalizePart(address);
  const streetNumber = normalizePart(number);

  if (street && streetNumber) {
    return `${street} ${streetNumber}`;
  }

  return street ?? streetNumber;
}

/**
 * Builds a single address string from Tiendanube billing fields.
 */
export function formatOrderBillingAddress(order: TiendanubeOrder): string {
  const parts: string[] = [];

  const billingName = normalizePart(order.billing_name);
  if (billingName) {
    parts.push(billingName);
  }

  const billingPhone = normalizePart(order.billing_phone);
  if (billingPhone) {
    parts.push(billingPhone);
  }

  const streetLine = joinStreetLine(order.billing_address, order.billing_number);
  if (streetLine) {
    parts.push(streetLine);
  }

  const optionalParts = [
    order.billing_floor,
    order.billing_locality,
    order.billing_zipcode,
    order.billing_city,
    order.billing_province,
    order.billing_country,
  ];

  for (const part of optionalParts) {
    const normalized = normalizePart(part);
    if (normalized) {
      parts.push(normalized);
    }
  }

  return parts.join(', ');
}
