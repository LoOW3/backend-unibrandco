import type { APIGatewayProxyEventV2 } from 'aws-lambda';

import { isAdminUser } from '../../shared/admin-auth';
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
