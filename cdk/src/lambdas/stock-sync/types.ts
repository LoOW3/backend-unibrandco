export type { PatagoniaStockItem } from '../../shared/patagonia-stock.types';

/** Result of a successful stock sync operation. */
export interface StockSyncResult {
  s3Key: string;
  itemCount: number;
  syncedAt: string;
}

/** Environment variables required by the stock sync Lambda. */
export interface StockSyncEnv {
  STOCK_BUCKET_NAME: string;
  PATAGONIA_API_URL: string;
  PATAGONIA_API_KEY_SECRET_ARN: string;
}

/** JWT claims available from API Gateway HTTP API Cognito authorizer. */
export interface CognitoJwtClaims {
  sub?: string;
  email?: string;
  'cognito:groups'?: string | string[];
}
