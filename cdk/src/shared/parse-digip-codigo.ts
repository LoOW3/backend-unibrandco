export class ParseDigipCodigoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseDigipCodigoError';
  }
}

const TN_SUFFIX = 'TN';

/**
 * Strips the Tiendanube suffix from a DigipWMS pedido Codigo (e.g. 1984097529TN → 1984097529).
 */
export function parseTiendanubeOrderIdFromDigipCodigo(codigo: string): number {
  const trimmed = codigo.trim();

  if (!trimmed) {
    throw new ParseDigipCodigoError('Digip codigo is empty');
  }

  const withoutSuffix = trimmed.endsWith(TN_SUFFIX)
    ? trimmed.slice(0, -TN_SUFFIX.length)
    : trimmed;

  const orderId = Number.parseInt(withoutSuffix, 10);

  if (!Number.isFinite(orderId) || orderId < 1) {
    throw new ParseDigipCodigoError(`Invalid Digip codigo for Tiendanube order id: ${codigo}`);
  }

  return orderId;
}
