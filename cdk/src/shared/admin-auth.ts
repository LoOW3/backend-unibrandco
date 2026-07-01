import type { CognitoJwtClaims } from './cognito.types';

export const ADMIN_GROUP = 'ADMIN';
export const SUPER_ADMIN_GROUP = 'SUPER_ADMIN';

/**
 * Parses cognito:groups from JWT claims as returned by API Gateway HTTP API.
 * The HTTP API JWT authorizer serializes a multi-valued claim as a
 * space-separated, bracketed string (e.g. "[ADMIN SUPER_ADMIN]"); a single
 * value comes as "[ADMIN]"; the raw ID token JWT has a real string[].
 * Also tolerates JSON arrays and comma-separated strings.
 */
export function parseCognitoGroups(
  groups: string | string[] | undefined,
): string[] {
  if (!groups) {
    return [];
  }

  if (Array.isArray(groups)) {
    return groups;
  }

  const trimmed = groups.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch {
      // API Gateway's bracketed form is space- (or comma-) separated, unquoted.
      return trimmed
        .slice(1, -1)
        .split(/[\s,]+/)
        .map((group) => group.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
  }

  return trimmed
    .split(/[\s,]+/)
    .map((group) => group.trim())
    .filter(Boolean);
}

/**
 * Extracts cognito:groups from JWT claims, checking common API Gateway key formats.
 */
export function getGroupsFromClaims(
  claims: CognitoJwtClaims | Record<string, string | string[] | undefined> | undefined,
): string[] {
  if (!claims) {
    return [];
  }

  const record = claims as Record<string, string | string[] | undefined>;
  const groupsClaim =
    record['cognito:groups'] ??
    record['cognito_groups'];

  return parseCognitoGroups(groupsClaim);
}

/**
 * Checks whether the JWT claims include membership in the ADMIN group.
 */
export function isAdminUser(
  claims: CognitoJwtClaims | Record<string, string | string[] | undefined> | undefined,
): boolean {
  const groups = getGroupsFromClaims(claims);
  return groups.includes(ADMIN_GROUP) || groups.includes(SUPER_ADMIN_GROUP);
}

/**
 * Checks whether the JWT claims include membership in the SUPER_ADMIN group.
 */
export function isSuperAdminUser(
  claims: CognitoJwtClaims | Record<string, string | string[] | undefined> | undefined,
): boolean {
  return getGroupsFromClaims(claims).includes(SUPER_ADMIN_GROUP);
}
