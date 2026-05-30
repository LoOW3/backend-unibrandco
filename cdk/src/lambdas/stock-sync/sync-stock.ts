import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

import { buildStockS3Key } from './s3-key';
import type { PatagoniaStockItem, StockSyncEnv, StockSyncResult } from './types';

let cachedApiKey: string | undefined;

/**
 * Retrieves the Patagonia WMS API key from Secrets Manager with in-memory cache.
 */
async function getApiKey(secretArn: string): Promise<string> {
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

/**
 * Fetches stock data from Patagonia WMS and stores it in S3.
 */
export async function syncStock(env: StockSyncEnv): Promise<StockSyncResult> {
  const apiKey = await getApiKey(env.PATAGONIA_API_KEY_SECRET_ARN);

  console.log({
    action: 'fetching stock from Patagonia WMS',
    request: {
      url: env.PATAGONIA_API_URL,
      headers: {
        'X-API-KEY': apiKey,
        Accept: 'application/json',
      },
    },
  });
  const response = await fetch(env.PATAGONIA_API_URL, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Patagonia WMS request failed: ${response.status} ${response.statusText}`,
    );
  }

  const stockItems = (await response.json()) as PatagoniaStockItem[];

  if (!Array.isArray(stockItems)) {
    throw new Error('Patagonia WMS response is not a JSON array');
  }

  const syncedAt = new Date();
  const s3Key = buildStockS3Key(syncedAt);
  const s3Client = new S3Client({});

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.STOCK_BUCKET_NAME,
      Key: s3Key,
      Body: JSON.stringify(stockItems),
      ContentType: 'application/json',
    }),
  );

  return {
    s3Key,
    itemCount: stockItems.length,
    syncedAt: syncedAt.toISOString(),
  };
}
