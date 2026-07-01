import type { Context } from 'aws-lambda';

import { isAbortRequested } from '../abort';
import { getBucketName } from '../env';
import { markRunAborted, markRunFailed } from '../manifest';
import type { ManualSyncState } from '../types';

/** State + Step Functions error payload (injected via Catch ResultPath). */
interface FailRunEvent extends ManualSyncState {
  error?: { Error?: string; Cause?: string };
}

/** Extracts a readable message from a Step Functions error payload. */
function extractErrorMessage(error: FailRunEvent['error']): string {
  if (!error) {
    return 'Unknown error';
  }

  if (error.Cause) {
    try {
      const parsed = JSON.parse(error.Cause) as { errorMessage?: string };
      if (parsed.errorMessage) {
        return parsed.errorMessage;
      }
    } catch {
      // Cause is not JSON; fall through.
    }
    return error.Cause;
  }

  return error.Error ?? 'Unknown error';
}

/**
 * Catch handler: marks the run FAILED and records the error on the manifest.
 */
export async function handler(
  event: FailRunEvent,
  _context: Context,
): Promise<ManualSyncState> {
  const bucket = getBucketName();
  const message = extractErrorMessage(event.error);

  if (event.runPrefix) {
    const nowIso = new Date().toISOString();
    if (await isAbortRequested(bucket, event.runPrefix)) {
      await markRunAborted(bucket, event.runPrefix, nowIso);
      console.log(JSON.stringify({ action: 'manual sync run aborted', runId: event.runId }));
      return event;
    }
    await markRunFailed(bucket, event.runPrefix, nowIso, message);
  }

  console.error(JSON.stringify({ action: 'manual sync run failed', runId: event.runId, message }));
  return event;
}
