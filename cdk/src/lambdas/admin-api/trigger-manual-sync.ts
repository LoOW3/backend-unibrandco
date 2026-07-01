import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

import {
  buildInitialManifest,
  updateManifest,
  writeManifest,
} from '../manual-sync/manifest';
import { resolveNextRunPrefix } from '../manual-sync/run-key';
import type { ManualSyncState } from '../manual-sync/types';
import type { AdminApiEnv, TriggerManualSyncResponse } from './types';

let cachedSfnClient: SFNClient | undefined;

function getSfnClient(): SFNClient {
  if (!cachedSfnClient) {
    cachedSfnClient = new SFNClient({});
  }
  return cachedSfnClient;
}

/**
 * Allocates the next run-N prefix for today, writes the initial manifest, and
 * starts the manual stock sync state machine. Returns the runId synchronously
 * so the frontend can poll it immediately.
 */
export async function triggerManualSync(
  env: AdminApiEnv,
  options: { triggeredBy: string | null; dryRun: boolean },
): Promise<TriggerManualSyncResponse> {
  const bucket = env.STOCK_BUCKET_NAME;
  const now = new Date();
  const runPrefix = await resolveNextRunPrefix(bucket, now);
  const runId = runPrefix.replace(/\/$/, '');

  const state: ManualSyncState = {
    runId,
    runPrefix,
    triggeredBy: options.triggeredBy,
    dryRun: options.dryRun,
    executionArn: null,
  };

  await writeManifest(bucket, buildInitialManifest(state, now.toISOString()));

  const execution = await getSfnClient().send(
    new StartExecutionCommand({
      stateMachineArn: env.MANUAL_SYNC_STATE_MACHINE_ARN,
      input: JSON.stringify(state),
    }),
  );

  const executionArn = execution.executionArn ?? '';

  await updateManifest(bucket, runPrefix, (manifest) => {
    manifest.executionArn = executionArn;
  });

  return { runId, executionArn };
}
