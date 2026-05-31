import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

import type { TiendanubeConfig } from '../../shared/tiendanube.types';

let cachedConfig: TiendanubeConfig | undefined;

/**
 * Retrieves Tiendanube API credentials from Secrets Manager with in-memory cache.
 */
export async function getTiendanubeConfig(
  secretArn: string,
): Promise<TiendanubeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (!response.SecretString) {
    throw new Error('Tiendanube credentials secret is empty');
  }

  const parsed = JSON.parse(response.SecretString) as Partial<TiendanubeConfig>;

  if (!parsed.store_id || !parsed.access_token || !parsed.user_agent) {
    throw new Error(
      'Tiendanube credentials secret must include store_id, access_token, and user_agent',
    );
  }

  cachedConfig = {
    store_id: parsed.store_id,
    access_token: parsed.access_token,
    user_agent: parsed.user_agent,
  };

  return cachedConfig;
}

/** Clears cached config (for tests). */
export function clearTiendanubeConfigCache(): void {
  cachedConfig = undefined;
}
