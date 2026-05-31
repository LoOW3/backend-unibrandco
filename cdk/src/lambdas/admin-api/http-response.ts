import type { APIGatewayProxyResultV2 } from 'aws-lambda';

/**
 * Builds a JSON HTTP response for API Gateway HTTP API.
 */
export function jsonResponse(
  statusCode: number,
  body: unknown,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}
