import { formatOrderObservacion } from '../src/shared/format-order-observacion';
import type { OrderUserData } from '../src/shared/tiendanube.types';

describe('formatOrderObservacion', () => {
  it('formats userData as multiline text', () => {
    const userData: OrderUserData = {
      name: 'Fernando Irigoyen',
      phone: '',
      email: 'fernando@example.com',
      address: 'zuviria 991, caba',
    };

    expect(formatOrderObservacion(userData)).toBe(
      'Nombre: Fernando Irigoyen\nTeléfono: \nEmail: fernando@example.com\nDirección: zuviria 991, caba',
    );
  });

  it('truncates text longer than 280 characters', () => {
    const userData: OrderUserData = {
      name: 'x'.repeat(100),
      phone: 'y'.repeat(100),
      email: 'z'.repeat(100),
      address: 'a'.repeat(100),
    };

    const result = formatOrderObservacion(userData);

    expect(result.length).toBe(280);
    expect(result.endsWith('...')).toBe(true);
  });
});
