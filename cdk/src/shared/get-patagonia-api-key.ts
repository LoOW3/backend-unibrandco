import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

let cachedApiKey: string | undefined;

/**
 * Retrieves the Patagonia/DigipWMS API key from Secrets Manager with in-memory cache.
 */
export async function getPatagoniaApiKey(secretArn: string): Promise<string> {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  const client = new SecretsManagerClient({});
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (!response.SecretString) {
    throw new Error('Patagonia API key secret is empty');
  }

  cachedApiKey = response.SecretString;
  return response.SecretString;
}

/** Clears cached API key (for tests). */
export function clearPatagoniaApiKeyCache(): void {
  cachedApiKey = undefined;
}
