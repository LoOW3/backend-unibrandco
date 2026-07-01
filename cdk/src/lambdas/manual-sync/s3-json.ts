import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

let cachedClient: S3Client | undefined;

/** Returns a shared S3 client instance. */
export function getS3Client(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({});
  }
  return cachedClient;
}

/** Writes a value as pretty-printed JSON and returns the byte length written. */
export async function putJson(
  bucket: string,
  key: string,
  value: unknown,
): Promise<number> {
  const body = JSON.stringify(value, null, 2);
  const bytes = Buffer.byteLength(body, 'utf-8');

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }),
  );

  return bytes;
}

/** Reads and parses a JSON object from S3. */
export async function getJson<T>(bucket: string, key: string): Promise<T> {
  const response = await getS3Client().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  const body = await response.Body?.transformToString();

  if (!body) {
    throw new Error(`Empty S3 object: ${key}`);
  }

  return JSON.parse(body) as T;
}
