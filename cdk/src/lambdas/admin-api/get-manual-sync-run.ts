import { NoSuchKey, NotFound } from '@aws-sdk/client-s3';

import { readManifest } from '../manual-sync/manifest';
import { isRunPrefix } from '../manual-sync/run-key';
import type { Manifest } from '../manual-sync/types';
import type { AdminApiEnv } from './types';

export class ManualSyncRunError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ManualSyncRunError';
  }
}

/**
 * Reads a single run's manifest. runId is the run prefix without trailing slash
 * (e.g. manual-sync/2026/07/01/run-1).
 */
export async function getManualSyncRun(
  env: AdminApiEnv,
  runId: string | undefined,
): Promise<Manifest> {
  if (!runId) {
    throw new ManualSyncRunError(400, 'Missing runId');
  }

  const runPrefix = runId.endsWith('/') ? runId : `${runId}/`;

  if (!isRunPrefix(runPrefix)) {
    throw new ManualSyncRunError(
      400,
      'Invalid runId. Expected manual-sync/yyyy/mm/dd/run-N',
    );
  }

  try {
    return await readManifest(env.STOCK_BUCKET_NAME, runPrefix);
  } catch (error) {
    if (
      error instanceof NoSuchKey ||
      error instanceof NotFound ||
      (error instanceof Error &&
        (error.name === 'NoSuchKey' || error.name === 'NotFound'))
    ) {
      throw new ManualSyncRunError(404, 'Manual sync run not found');
    }
    throw error;
  }
}
