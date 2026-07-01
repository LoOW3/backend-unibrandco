import type { TiendanubeConfig } from './tiendanube.types';

/**
 * Builds Tiendanube API credentials from environment variables.
 */
export function getTiendanubeConfig(): TiendanubeConfig {
  const store_id = process.env.TIENDANUBE_STORE_ID;
  const access_token = process.env.TIENDANUBE_ACCESS_TOKEN;
  const user_agent = process.env.TIENDANUBE_USER_AGENT;

  if (!store_id || !access_token || !user_agent) {
    throw new Error(
      'Missing Tiendanube credentials: TIENDANUBE_STORE_ID, TIENDANUBE_ACCESS_TOKEN, and TIENDANUBE_USER_AGENT are required',
    );
  }

  return { store_id, access_token, user_agent };
}
