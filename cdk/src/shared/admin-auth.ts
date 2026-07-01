import type { CognitoJwtClaims } from './cognito.types';

export const ADMIN_GROUP = 'ADMIN';
export const SUPER_ADMIN_GROUP = 'SUPER_ADMIN';

/**
 * Parses cognito:groups from JWT claims as returned by API Gateway HTTP API.
 * API Gateway serializes array claims as strings (e.g. "[\"ADMIN\"]" or "ADMIN,USER").
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
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((group) => group.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
  }

  if (trimmed.includes(',')) {
    return trimmed.split(',').map((group) => group.trim()).filter(Boolean);
  }

  return [trimmed];
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
