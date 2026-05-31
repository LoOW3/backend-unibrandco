import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';

import { getDashboard } from './get-dashboard';
import {
  getStockFileDownload,
  StockFileDownloadError,
} from './get-stock-file-download';
import { getStockChange } from './get-stock-change';
import { jsonResponse } from './http-response';
import { isValidDateParam, listStockFiles } from './list-stock-files';
import { listStockChanges } from './list-stock-changes';
import { isAuthorizedAdmin, type HttpApiEventWithJwt } from './require-admin';
import type { AdminApiEnv } from './types';

function getEnv(): AdminApiEnv {
  const tableName = process.env.STOCK_CHANGES_TABLE_NAME;
  const bucketName = process.env.STOCK_BUCKET_NAME;
  const gsiName = process.env.GSI_NAME;

  if (!tableName || !bucketName || !gsiName) {
    throw new Error('Missing required environment variables for admin API');
  }

  return {
    STOCK_CHANGES_TABLE_NAME: tableName,
    STOCK_BUCKET_NAME: bucketName,
    GSI_NAME: gsiName,
  };
}

function normalizePath(rawPath: string): string {
  return rawPath.replace(/\/+$/, '') || '/';
}

/**
 * Lambda handler for admin read-only API routes.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context,
): Promise<APIGatewayProxyResultV2> {
  const httpEvent = event as HttpApiEventWithJwt;

  if (!isAuthorizedAdmin(httpEvent)) {
    return jsonResponse(403, { message: 'Forbidden: ADMIN group required' });
  }

  try {
    const env = getEnv();
    const method = httpEvent.requestContext.http.method;
    const path = normalizePath(httpEvent.rawPath);

    if (method === 'GET' && path === '/dashboard/admin') {
      const dashboard = await getDashboard(env);
      return jsonResponse(200, dashboard);
    }

    if (method === 'GET' && path === '/admin/stock-changes') {
      const result = await listStockChanges(env, httpEvent.queryStringParameters ?? {});
      return jsonResponse(200, result);
    }

    if (method === 'GET' && path.startsWith('/admin/stock-changes/')) {
      const syncKeyParam = httpEvent.pathParameters?.syncKey;
      const syncKey = decodeURIComponent(
        syncKeyParam ?? path.slice('/admin/stock-changes/'.length),
      );

      if (!syncKey) {
        return jsonResponse(400, { message: 'Missing syncKey' });
      }

      const record = await getStockChange(env, syncKey);

      if (!record) {
        return jsonResponse(404, { message: 'Stock change record not found' });
      }

      return jsonResponse(200, record);
    }

    if (method === 'GET' && path === '/admin/stock-files/download') {
      try {
        const download = await getStockFileDownload(
          env,
          httpEvent.queryStringParameters?.syncKey,
        );
        return jsonResponse(200, download);
      } catch (error) {
        if (error instanceof StockFileDownloadError) {
          return jsonResponse(error.statusCode, { message: error.message });
        }

        throw error;
      }
    }

    if (method === 'GET' && path === '/admin/stock-files') {
      const date = httpEvent.queryStringParameters?.date;

      if (!isValidDateParam(date)) {
        return jsonResponse(400, {
          message: 'Invalid or missing date query parameter. Expected YYYY-MM-DD.',
        });
      }

      const files = await listStockFiles(env, date);
      return jsonResponse(200, files);
    }

    return jsonResponse(404, { message: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(500, { message });
  }
}
