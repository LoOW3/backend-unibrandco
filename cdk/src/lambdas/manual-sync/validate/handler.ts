import type { Context } from 'aws-lambda';

import type { ProductsCleanExport } from '../../../shared/tiendanube.types';
import { getBucketName } from '../env';
import { markStepCompleted, markStepRunning } from '../manifest';
import { getJson, putJson } from '../s3-json';
import { buildValidationReport } from '../validate-products';
import { ARTIFACT_KEYS, type ManualSyncState } from '../types';

/**
 * Validates products-clean.json (one variant + one inventory level each).
 * Issues are non-fatal: they are recorded in the report and the manifest.
 */
export async function handler(
  state: ManualSyncState,
  _context: Context,
): Promise<ManualSyncState> {
  const bucket = getBucketName();
  await markStepRunning(bucket, state.runPrefix, 'validate', new Date().toISOString());

  const cleanKey = `${state.runPrefix}${ARTIFACT_KEYS.productsClean}`;
  const clean = await getJson<ProductsCleanExport>(bucket, cleanKey);
  const report = buildValidationReport(clean.products ?? []);

  const key = `${state.runPrefix}${ARTIFACT_KEYS.validationReport}`;
  const sizeBytes = await putJson(bucket, key, report);

  await markStepCompleted(bucket, state.runPrefix, 'validate', new Date().toISOString(), {
    result: { total: report.total, issueCount: report.issueCount, summary: report.summary },
    artifacts: [{ label: 'Validation report', s3Key: key, sizeBytes }],
  });

  return state;
}
