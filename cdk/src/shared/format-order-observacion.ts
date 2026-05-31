import type { OrderUserData } from './tiendanube.types';

const MAX_OBSERVACION_LENGTH = 280;

/**
 * Formats order userData as observacion text for DigipWMS (max 280 chars).
 */
export function formatOrderObservacion(userData: OrderUserData): string {
  const lines = [
    `Nombre: ${userData.name}`,
    `Teléfono: ${userData.phone}`,
    `Email: ${userData.email}`,
    `Dirección: ${userData.address}`,
  ];

  const text = lines.join('\n');

  if (text.length <= MAX_OBSERVACION_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_OBSERVACION_LENGTH - 3)}...`;
}
