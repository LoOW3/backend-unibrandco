import type { Context } from 'aws-lambda';

import { getPatagoniaApiKey } from '../../../shared/get-patagonia-api-key';
import type { PatagoniaStockItem } from '../../../shared/patagonia-stock.types';
import { throwIfAborted } from '../abort';
import { getBucketName, getPatagoniaApiUrl } from '../env';
import { markStepCompleted, markStepRunning } from '../manifest';
import { putJson } from '../s3-json';
import { ARTIFACT_KEYS, type ManualSyncState } from '../types';

/**
 * Fetches the full Patagonia WMS stock snapshot and stores it under the run
 * prefix (replaces the manual 193753.json copy step).
 */
export async function handler(
  state: ManualSyncState,
  _context: Context,
): Promise<ManualSyncState> {
  const bucket = getBucketName();
  await throwIfAborted(bucket, state.runPrefix);
  await markStepRunning(bucket, state.runPrefix, 'fetch-patagonia', new Date().toISOString());

  const apiKey = getPatagoniaApiKey();
  const response = await fetch(getPatagoniaApiUrl(), {
    method: 'GET',
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
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

  const key = `${state.runPrefix}${ARTIFACT_KEYS.patagoniaStock}`;
  const sizeBytes = await putJson(bucket, key, stockItems);

  await markStepCompleted(bucket, state.runPrefix, 'fetch-patagonia', new Date().toISOString(), {
    result: { itemCount: stockItems.length },
    artifacts: [{ label: 'Patagonia snapshot', s3Key: key, sizeBytes }],
    counts: { patagoniaItems: stockItems.length },
  });

  return state;
}
