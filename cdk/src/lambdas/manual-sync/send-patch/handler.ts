import type { Context } from 'aws-lambda';

import { getTiendanubeConfig } from '../../../shared/get-tiendanube-config';
import type { TiendanubeStockPatchItem } from '../../../shared/tiendanube.types';
import { chunkPatchItems } from '../../tiendanube-stock-sync/build-stock-patch';
import { getApiVersion, getBucketName, getSendBatchChunks } from '../env';
import {
  markStepCompleted,
  markStepRunning,
  updateSendProgress,
} from '../manifest';
import { getJson, putJson } from '../s3-json';
import { patchStockChunk } from './patch-chunk';
import { ARTIFACT_KEYS, type ManualSyncState } from '../types';

const PATCH_CHUNK_SIZE = 50;

/**
 * Sends the stock patch to Tiendanube in batches of chunks. Invoked repeatedly
 * by the state machine (Choice + Wait loop) until sendDone is true, so a large
 * catalog is paced under both the Lambda timeout and the Tiendanube rate limit.
 */
export async function handler(
  state: ManualSyncState,
  _context: Context,
): Promise<ManualSyncState> {
  const bucket = getBucketName();
  const cursor = state.sendCursor ?? 0;

  if (cursor === 0) {
    await markStepRunning(bucket, state.runPrefix, 'send-patch', new Date().toISOString());
  }

  const patchKey = `${state.runPrefix}${ARTIFACT_KEYS.stockPatch}`;
  const patchItems = await getJson<TiendanubeStockPatchItem[]>(bucket, patchKey);
  const chunks = chunkPatchItems(patchItems, PATCH_CHUNK_SIZE);
  const totalChunks = chunks.length;

  const batchSize = getSendBatchChunks();
  const end = Math.min(cursor + batchSize, totalChunks);

  if (!state.dryRun) {
    const config = getTiendanubeConfig();
    const apiVersion = getApiVersion();
    for (let index = cursor; index < end; index += 1) {
      await patchStockChunk(config, apiVersion, chunks[index]);
    }
  }

  const sendDone = end >= totalChunks;
  await updateSendProgress(bucket, state.runPrefix, end, totalChunks);

  if (sendDone) {
    const patchedProducts = patchItems.length;
    const sendReport = {
      totalChunks,
      totalProducts: patchedProducts,
      chunkSize: PATCH_CHUNK_SIZE,
      dryRun: state.dryRun,
    };
    const key = `${state.runPrefix}${ARTIFACT_KEYS.sendReport}`;
    const sizeBytes = await putJson(bucket, key, sendReport);

    await markStepCompleted(bucket, state.runPrefix, 'send-patch', new Date().toISOString(), {
      result: { totalChunks, patched: patchedProducts, dryRun: state.dryRun },
      artifacts: [{ label: 'Send report', s3Key: key, sizeBytes }],
      counts: { patched: patchedProducts, sendChunksTotal: totalChunks, sendChunksSent: end },
    });
  }

  return { ...state, sendCursor: end, sendTotalChunks: totalChunks, sendDone };
}
