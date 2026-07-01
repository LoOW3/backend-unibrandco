import {
  ARTIFACT_KEYS,
  MANUAL_SYNC_STEPS,
  type Manifest,
  type ManifestArtifact,
  type ManifestCounts,
  type ManualSyncState,
  type ManualSyncStepKey,
} from './types';
import { getJson, putJson } from './s3-json';

/** Returns the manifest.json S3 key for a run prefix. */
export function manifestKey(runPrefix: string): string {
  return `${runPrefix}${ARTIFACT_KEYS.manifest}`;
}

/** Builds the initial manifest for a freshly created run. */
export function buildInitialManifest(
  state: Pick<ManualSyncState, 'runId' | 'runPrefix' | 'triggeredBy' | 'dryRun' | 'executionArn'>,
  nowIso: string,
): Manifest {
  return {
    runId: state.runId,
    runPrefix: state.runPrefix,
    startedAt: nowIso,
    completedAt: null,
    status: 'RUNNING',
    triggeredBy: state.triggeredBy,
    executionArn: state.executionArn,
    dryRun: state.dryRun,
    currentStep: MANUAL_SYNC_STEPS[0].key,
    progress: 0,
    steps: MANUAL_SYNC_STEPS.map((step) => ({
      key: step.key,
      label: step.label,
      status: 'PENDING',
    })),
    artifacts: [],
    counts: {},
    error: null,
  };
}

/** Reads the run manifest from S3. */
export function readManifest(bucket: string, runPrefix: string): Promise<Manifest> {
  return getJson<Manifest>(bucket, manifestKey(runPrefix));
}

/** Writes the run manifest to S3. */
export async function writeManifest(
  bucket: string,
  manifest: Manifest,
): Promise<void> {
  await putJson(bucket, manifestKey(manifest.runPrefix), manifest);
}

/** Progress as completed-steps / total-steps, rounded to a percentage. */
function completedStepsProgress(manifest: Manifest): number {
  const completed = manifest.steps.filter((step) => step.status === 'COMPLETED').length;
  return Math.round((completed / MANUAL_SYNC_STEPS.length) * 100);
}

/** Read-modify-write the manifest with a mutator, returning the new manifest. */
export async function updateManifest(
  bucket: string,
  runPrefix: string,
  mutate: (manifest: Manifest) => void,
): Promise<Manifest> {
  const manifest = await readManifest(bucket, runPrefix);
  mutate(manifest);
  await writeManifest(bucket, manifest);
  return manifest;
}

/** Marks a step RUNNING and sets it as the current step. */
export function markStepRunning(
  bucket: string,
  runPrefix: string,
  key: ManualSyncStepKey,
  nowIso: string,
): Promise<Manifest> {
  return updateManifest(bucket, runPrefix, (manifest) => {
    manifest.currentStep = key;
    const step = manifest.steps.find((entry) => entry.key === key);
    if (step) {
      step.status = 'RUNNING';
      step.startedAt = nowIso;
    }
  });
}

/** Marks a step COMPLETED, appending artifacts/counts and recomputing progress. */
export function markStepCompleted(
  bucket: string,
  runPrefix: string,
  key: ManualSyncStepKey,
  nowIso: string,
  options: {
    result?: Record<string, unknown>;
    artifacts?: ManifestArtifact[];
    counts?: ManifestCounts;
  } = {},
): Promise<Manifest> {
  return updateManifest(bucket, runPrefix, (manifest) => {
    const step = manifest.steps.find((entry) => entry.key === key);
    if (step) {
      step.status = 'COMPLETED';
      step.completedAt = nowIso;
      if (options.result) {
        step.result = options.result;
      }
    }
    if (options.artifacts?.length) {
      manifest.artifacts.push(...options.artifacts);
    }
    if (options.counts) {
      manifest.counts = { ...manifest.counts, ...options.counts };
    }
    manifest.progress = completedStepsProgress(manifest);
  });
}

/** Updates send-patch chunk progress, blending into the last sixth of progress. */
export function updateSendProgress(
  bucket: string,
  runPrefix: string,
  sent: number,
  total: number,
): Promise<Manifest> {
  return updateManifest(bucket, runPrefix, (manifest) => {
    manifest.counts.sendChunksSent = sent;
    manifest.counts.sendChunksTotal = total;
    const fraction = total > 0 ? sent / total : 0;
    const completedBefore = MANUAL_SYNC_STEPS.length - 1; // steps done before send
    manifest.progress = Math.round(
      ((completedBefore + fraction) / MANUAL_SYNC_STEPS.length) * 100,
    );
  });
}

/** Marks the whole run COMPLETED. */
export function markRunCompleted(
  bucket: string,
  runPrefix: string,
  nowIso: string,
): Promise<Manifest> {
  return updateManifest(bucket, runPrefix, (manifest) => {
    manifest.status = 'COMPLETED';
    manifest.completedAt = nowIso;
    manifest.currentStep = null;
    manifest.progress = 100;
  });
}

/** Marks the run FAILED, recording the failing step and error message. */
export function markRunFailed(
  bucket: string,
  runPrefix: string,
  nowIso: string,
  errorMessage: string,
): Promise<Manifest> {
  return updateManifest(bucket, runPrefix, (manifest) => {
    manifest.status = 'FAILED';
    manifest.completedAt = nowIso;
    manifest.error = errorMessage;
    const runningStep = manifest.steps.find((step) => step.status === 'RUNNING');
    if (runningStep) {
      runningStep.status = 'FAILED';
      runningStep.completedAt = nowIso;
      runningStep.error = errorMessage;
    }
  });
}
