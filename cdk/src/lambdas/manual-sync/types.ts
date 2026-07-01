/** Ordered list of the user-visible pipeline steps (drives progress + UI stepper). */
export const MANUAL_SYNC_STEPS = [
  { key: 'fetch-patagonia', label: 'Fetch Patagonia WMS' },
  { key: 'fetch-tiendanube', label: 'Fetch Tiendanube' },
  { key: 'clean', label: 'Clean catalog' },
  { key: 'validate', label: 'Validate catalog' },
  { key: 'build-patch', label: 'Build stock patch' },
  { key: 'send-patch', label: 'Send patch to Tiendanube' },
] as const;

export type ManualSyncStepKey = (typeof MANUAL_SYNC_STEPS)[number]['key'];

export type ManualSyncStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type ManualSyncStepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/** One step entry inside the run manifest. */
export interface ManifestStep {
  key: ManualSyncStepKey;
  label: string;
  status: ManualSyncStepStatus;
  startedAt?: string;
  completedAt?: string;
  result?: Record<string, unknown>;
  error?: string;
}

/** A generated artifact stored under the run prefix. */
export interface ManifestArtifact {
  label: string;
  s3Key: string;
  sizeBytes: number;
}

/** Aggregate counts surfaced in the UI. */
export interface ManifestCounts {
  patagoniaItems?: number;
  tnProducts?: number;
  matched?: number;
  skipped?: number;
  patched?: number;
  sendChunksTotal?: number;
  sendChunksSent?: number;
}

/** The single source of truth for a run, stored as manifest.json in S3. */
export interface Manifest {
  runId: string;
  runPrefix: string;
  startedAt: string;
  completedAt: string | null;
  status: ManualSyncStatus;
  triggeredBy: string | null;
  executionArn: string | null;
  dryRun: boolean;
  currentStep: ManualSyncStepKey | null;
  progress: number;
  steps: ManifestStep[];
  artifacts: ManifestArtifact[];
  counts: ManifestCounts;
  error: string | null;
}

/**
 * State object threaded through the Step Functions state machine. Every step
 * Lambda receives it as input and returns it (merged) as output.
 */
export interface ManualSyncState {
  runId: string;
  runPrefix: string;
  triggeredBy: string | null;
  dryRun: boolean;
  executionArn: string | null;
  /** send-patch loop bookkeeping. */
  sendCursor?: number;
  sendTotalChunks?: number;
  sendDone?: boolean;
}

/** Artifact object keys (relative to the run prefix). */
export const ARTIFACT_KEYS = {
  manifest: 'manifest.json',
  patagoniaStock: 'patagonia-stock.json',
  products: 'products.json',
  productsClean: 'products-clean.json',
  validationReport: 'validation-report.json',
  stockPatch: 'stock-patch.json',
  skippedSkus: 'skipped-skus.json',
  sendReport: 'send-report.json',
} as const;
