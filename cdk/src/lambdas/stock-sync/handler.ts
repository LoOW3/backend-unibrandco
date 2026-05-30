import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
  EventBridgeEvent,
  ScheduledEvent,
} from 'aws-lambda';

import { isAdminUser } from './admin-auth';
import { syncStock } from './sync-stock';
import type { CognitoJwtClaims, StockSyncEnv, StockSyncResult } from './types';

type StockSyncHandlerEvent =
  | EventBridgeEvent<'Scheduled Event', ScheduledEvent>
  | APIGatewayProxyEventV2;

function getEnv(): StockSyncEnv {
  const bucketName = process.env.STOCK_BUCKET_NAME;
  const apiUrl = process.env.PATAGONIA_API_URL;
  const secretArn = process.env.PATAGONIA_API_KEY_SECRET_ARN;

  if (!bucketName || !apiUrl || !secretArn) {
    throw new Error('Missing required environment variables for stock sync');
  }

  return {
    STOCK_BUCKET_NAME: bucketName,
    PATAGONIA_API_URL: apiUrl,
    PATAGONIA_API_KEY_SECRET_ARN: secretArn,
  };
}

function isScheduledEvent(event: StockSyncHandlerEvent): event is EventBridgeEvent<'Scheduled Event', ScheduledEvent> {
  return 'source' in event && event.source === 'aws.events';
}

function isHttpEvent(event: StockSyncHandlerEvent): event is APIGatewayProxyEventV2 {
  return 'requestContext' in event && 'http' in event.requestContext;
}

/** HTTP API event with Cognito JWT authorizer context. */
interface HttpApiEventWithJwt extends APIGatewayProxyEventV2 {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: {
      jwt?: {
        claims?: CognitoJwtClaims;
      };
    };
  };
}

function jsonResponse(
  statusCode: number,
  body: StockSyncResult | { message: string },
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Lambda handler for scheduled and manual stock sync triggers.
 */
export async function handler(
  event: StockSyncHandlerEvent,
  _context: Context,
): Promise<APIGatewayProxyResultV2 | StockSyncResult> {
  try {
    if (isHttpEvent(event)) {
      const httpEvent = event as HttpApiEventWithJwt;
      const authorizer = httpEvent.requestContext.authorizer;
      const claims =
        authorizer?.jwt?.claims ??
        (authorizer as Record<string, string | string[] | undefined> | undefined);

      if (!isAdminUser(claims)) {
        return jsonResponse(403, { message: 'Forbidden: ADMIN group required' });
      }

      const result = await syncStock(getEnv());
      return jsonResponse(200, result);
    }

    if (isScheduledEvent(event)) {
      return await syncStock(getEnv());
    }

    throw new Error('Unsupported event source');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (isHttpEvent(event)) {
      return jsonResponse(500, { message });
    }

    throw error;
  }
}
