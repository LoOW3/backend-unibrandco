import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

import type { PatagoniaStockItem } from '../../shared/patagonia-stock.types';
import {
  buildSnapshotDayPrefixes,
  isStockSnapshotKey,
} from './parse-sync-key';

async function readSnapshotBody(
  s3Client: S3Client,
  bucketName: string,
  key: string,
): Promise<PatagoniaStockItem[]> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );

  const body = await response.Body?.transformToString();

  if (!body) {
    throw new Error(`Snapshot ${key} is empty`);
  }

  const items = JSON.parse(body) as PatagoniaStockItem[];

  if (!Array.isArray(items)) {
    throw new Error(`Snapshot ${key} is not a JSON array`);
  }

  return items;
}

async function listKeysByPrefix(
  s3Client: S3Client,
  bucketName: string,
  prefix: string,
): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (object.Key && isStockSnapshotKey(object.Key)) {
        keys.push(object.Key);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

/**
 * Lists stock snapshot keys for the current and previous UTC day, sorted chronologically.
 */
export async function listSnapshotKeys(
  s3Client: S3Client,
  bucketName: string,
  currentSyncKey: string,
): Promise<string[]> {
  const prefixes = buildSnapshotDayPrefixes(currentSyncKey);
  const prefixResults = await Promise.all(
    prefixes.map((prefix) => listKeysByPrefix(s3Client, bucketName, prefix)),
  );

  const keySet = new Set(prefixResults.flat());

  if (isStockSnapshotKey(currentSyncKey)) {
    keySet.add(currentSyncKey);
  }

  return [...keySet].sort();
}

/**
 * Returns the snapshot key immediately before the given current key.
 */
export function findPreviousSnapshotKey(
  sortedKeys: string[],
  currentKey: string,
): string | undefined {
  const currentIndex = sortedKeys.indexOf(currentKey);

  if (currentIndex === -1) {
    return sortedKeys.at(-1);
  }

  if (currentIndex <= 0) {
    return undefined;
  }

  return sortedKeys[currentIndex - 1];
}

/**
 * Loads current and previous stock snapshots from S3.
 */
export async function loadSnapshots(
  bucketName: string,
  currentKey: string,
  previousKey: string,
): Promise<{ currentItems: PatagoniaStockItem[]; previousItems: PatagoniaStockItem[] }> {
  const s3Client = new S3Client({});

  const [currentItems, previousItems] = await Promise.all([
    readSnapshotBody(s3Client, bucketName, currentKey),
    readSnapshotBody(s3Client, bucketName, previousKey),
  ]);

  return { currentItems, previousItems };
}
