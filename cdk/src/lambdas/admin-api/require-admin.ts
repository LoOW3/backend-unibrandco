import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { isAdminUser, isSuperAdminUser } from '../../shared/admin-auth';
import type { CognitoJwtClaims } from '../../shared/cognito.types';

/** HTTP API event with Cognito JWT authorizer context. */
export interface HttpApiEventWithJwt extends APIGatewayProxyEventV2 {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: {
      jwt?: {
        claims?: CognitoJwtClaims;
      };
    };
  };
}

/**
 * Extracts JWT claims from an HTTP API event.
 */
export function getClaimsFromEvent(
  event: HttpApiEventWithJwt,
): CognitoJwtClaims | Record<string, string | string[] | undefined> | undefined {
  const authorizer = event.requestContext.authorizer;
  return (
    authorizer?.jwt?.claims ??
    (authorizer as Record<string, string | string[] | undefined> | undefined)
  );
}

/**
 * Returns true when the request is from an ADMIN user.
 */
export function isAuthorizedAdmin(event: HttpApiEventWithJwt): boolean {
  return isAdminUser(getClaimsFromEvent(event));
}

/**
 * Returns true when the request is from a SUPER_ADMIN user.
 */
export function isAuthorizedSuperAdmin(event: HttpApiEventWithJwt): boolean {
  return isSuperAdminUser(getClaimsFromEvent(event));
}

/** Caller identity extracted from the JWT authorizer claims. */
export interface CallerIdentity {
  sub: string | null;
  email: string | null;
  name: string | null;
}

/**
 * Reads the authenticated caller's sub/email/name from the JWT claims.
 */
export function getCallerIdentity(event: HttpApiEventWithJwt): CallerIdentity {
  const claims = getClaimsFromEvent(event) as Record<string, string | string[] | undefined> | undefined;
  const read = (key: string): string | null => {
    const value = claims?.[key];
    return typeof value === 'string' ? value : null;
  };
  return { sub: read('sub'), email: read('email'), name: read('name') };
}
