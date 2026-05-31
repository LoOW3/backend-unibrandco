const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parses a limit query parameter with defaults and bounds.
 */
export function parseLimit(rawLimit: string | undefined): number {
  if (!rawLimit) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawLimit, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

/**
 * Decodes a base64url pagination cursor into a DynamoDB ExclusiveStartKey.
 */
export function decodeCursor(
  rawCursor: string | undefined,
): Record<string, unknown> | undefined {
  if (!rawCursor) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(rawCursor, 'base64url').toString('utf8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Encodes a DynamoDB LastEvaluatedKey as a base64url pagination cursor.
 */
export function encodeCursor(
  lastEvaluatedKey: Record<string, unknown> | undefined,
): string | null {
  if (!lastEvaluatedKey) {
    return null;
  }

  return Buffer.from(JSON.stringify(lastEvaluatedKey), 'utf8').toString('base64url');
}
