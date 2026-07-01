import {
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

import { getS3Client } from './s3-json';

/** S3 key of the abort marker for a run. */
export function abortMarkerKey(runPrefix: string): string {
  return `${runPrefix}abort-requested`;
}

/** Writes the abort marker; a running step Lambda sees it and self-terminates. */
export async function writeAbortMarker(bucket: string, runPrefix: string): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: abortMarkerKey(runPrefix),
      Body: '',
      ContentType: 'text/plain',
    }),
  );
}

/** True when an abort has been requested for the run. */
export async function isAbortRequested(bucket: string, runPrefix: string): Promise<boolean> {
  try {
    await getS3Client().send(
      new HeadObjectCommand({ Bucket: bucket, Key: abortMarkerKey(runPrefix) }),
    );
    return true;
  } catch (error) {
    if (
      error instanceof NotFound ||
      (error instanceof Error && (error.name === 'NotFound' || error.name === 'NotFound'))
    ) {
      return false;
    }
    // Treat other head failures as "not aborted" to avoid killing a healthy run.
    return false;
  }
}

/** Throws when an abort has been requested, so the step aborts via the Catch path. */
export async function throwIfAborted(bucket: string, runPrefix: string): Promise<void> {
  if (await isAbortRequested(bucket, runPrefix)) {
    throw new Error('aborted');
  }
}
