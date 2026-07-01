import type { Context } from 'aws-lambda';

import { getBucketName } from '../env';
import { markRunCompleted } from '../manifest';
import type { ManualSyncState } from '../types';

/**
 * Final state: marks the manifest COMPLETED with 100% progress.
 */
export async function handler(
  state: ManualSyncState,
  _context: Context,
): Promise<ManualSyncState> {
  const bucket = getBucketName();
  await markRunCompleted(bucket, state.runPrefix, new Date().toISOString());
  console.log(JSON.stringify({ action: 'manual sync run completed', runId: state.runId }));
  return state;
}
