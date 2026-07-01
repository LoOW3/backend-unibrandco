import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

import { readManifest } from '../manual-sync/manifest';
import {
  buildManualSyncDayPrefixFromDate,
  getRunNumber,
  isRunPrefix,
} from '../manual-sync/run-key';
import type { AdminApiEnv, ManualSyncRunSummary, ManualSyncRunsResponse } from './types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a date query parameter in YYYY-MM-DD format. */
export function isValidDateParam(date: string | undefined): date is string {
  return Boolean(date && DATE_PATTERN.test(date));
}

/**
 * Lists manual sync runs for a given UTC day by reading each run's manifest.
 */
export async function listManualSyncRuns(
  env: AdminApiEnv,
  date: string,
): Promise<ManualSyncRunsResponse> {
  const dayPrefix = buildManualSyncDayPrefixFromDate(date);
  const s3Client = new S3Client({});

  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: env.STOCK_BUCKET_NAME,
      Prefix: dayPrefix,
      Delimiter: '/',
    }),
  );

  const runPrefixes = (response.CommonPrefixes ?? [])
    .map((entry) => entry.Prefix)
    .filter((prefix): prefix is string => Boolean(prefix) && isRunPrefix(prefix));

  const summaries = await Promise.all(
    runPrefixes.map(async (prefix): Promise<ManualSyncRunSummary | null> => {
      try {
        const manifest = await readManifest(env.STOCK_BUCKET_NAME, prefix);
        return {
          runId: manifest.runId,
          status: manifest.status,
          startedAt: manifest.startedAt,
          completedAt: manifest.completedAt,
          progress: manifest.progress,
          currentStep: manifest.currentStep,
          triggeredBy: manifest.triggeredBy,
          dryRun: manifest.dryRun,
          counts: manifest.counts,
          error: manifest.error,
        };
      } catch {
        return null;
      }
    }),
  );

  const runs = summaries
    .filter((summary): summary is ManualSyncRunSummary => summary !== null)
    .sort((left, right) => {
      const leftNum = getRunNumber(`${left.runId}/`) ?? 0;
      const rightNum = getRunNumber(`${right.runId}/`) ?? 0;
      return rightNum - leftNum;
    });

  return { date, runs };
}
