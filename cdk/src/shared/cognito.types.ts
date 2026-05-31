/** JWT claims available from API Gateway HTTP API Cognito authorizer. */
export interface CognitoJwtClaims {
  sub?: string;
  email?: string;
  'cognito:groups'?: string | string[];
}
