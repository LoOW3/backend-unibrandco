const SENSITIVE_HEADER_NAMES = new Set(['authorization', 'x-api-key']);

/**
 * Returns request headers safe to log (excludes common secrets).
 */
export function filterHeadersForLog(
  headers: Record<string, string | undefined> | undefined,
): Record<string, string> {
  if (!headers) {
    return {};
  }

  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (SENSITIVE_HEADER_NAMES.has(key.toLowerCase())) {
      continue;
    }

    filtered[key] = value;
  }

  return filtered;
}
