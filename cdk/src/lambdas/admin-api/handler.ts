import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';

import { getDashboard } from './get-dashboard';
import {
  getStockFileDownload,
  StockFileDownloadError,
} from './get-stock-file-download';
import { getPatagoniaPedido } from './get-patagonia-pedido';
import { resolvePatagoniaPedidoStatus } from '../../shared/resolve-patagonia-pedido-status';
import type { PatagoniaPedidoRecordResponse } from '../../shared/patagonia-pedidos.types';
import { writeAbortMarker } from '../manual-sync/abort';
import { getManualSyncRun, ManualSyncRunError } from './get-manual-sync-run';
import { getStockChange } from './get-stock-change';
import { jsonResponse } from './http-response';
import {
  isValidDateParam as isValidManualSyncDate,
  listManualSyncRuns,
} from './list-manual-sync-runs';
import { isValidDateParam, listStockFiles } from './list-stock-files';
import { listPatagoniaPedidos } from './list-patagonia-pedidos';
import { listStockChanges } from './list-stock-changes';
import {
  getClaimsFromEvent,
  isAuthorizedAdmin,
  type HttpApiEventWithJwt,
} from './require-admin';
import { ManualSyncConflictError, triggerManualSync } from './trigger-manual-sync';
import type { AdminApiEnv } from './types';
import { handleUsersRoutes } from './users/routes';

function getEnv(): AdminApiEnv {
  const tableName = process.env.STOCK_CHANGES_TABLE_NAME;
  const bucketName = process.env.STOCK_BUCKET_NAME;
  const gsiName = process.env.GSI_NAME;
  const patagoniaPedidosTableName = process.env.PATAGONIA_PEDIDOS_TABLE_NAME;
  const patagoniaPedidosGsiName = process.env.PATAGONIA_PEDIDOS_GSI_NAME;
  const manualSyncStateMachineArn = process.env.MANUAL_SYNC_STATE_MACHINE_ARN;
  const userPoolId = process.env.USER_POOL_ID;

  if (
    !tableName ||
    !bucketName ||
    !gsiName ||
    !patagoniaPedidosTableName ||
    !patagoniaPedidosGsiName ||
    !manualSyncStateMachineArn ||
    !userPoolId
  ) {
    throw new Error('Missing required environment variables for admin API');
  }

  return {
    STOCK_CHANGES_TABLE_NAME: tableName,
    STOCK_BUCKET_NAME: bucketName,
    GSI_NAME: gsiName,
    PATAGONIA_PEDIDOS_TABLE_NAME: patagoniaPedidosTableName,
    PATAGONIA_PEDIDOS_GSI_NAME: patagoniaPedidosGsiName,
    MANUAL_SYNC_STATE_MACHINE_ARN: manualSyncStateMachineArn,
    USER_POOL_ID: userPoolId,
  };
}

/** Extracts the triggering user's email from JWT claims, if present. */
function getTriggeredBy(event: HttpApiEventWithJwt): string | null {
  const claims = getClaimsFromEvent(event);
  const email = claims?.['email'];
  return typeof email === 'string' ? email : null;
}

/** Parses an optional { dryRun } flag from the request body. */
function parseDryRun(body: string | undefined): boolean {
  if (!body) {
    return false;
  }
  try {
    const parsed = JSON.parse(body) as { dryRun?: unknown };
    return parsed.dryRun === true;
  } catch {
    return false;
  }
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

    if (method === 'GET' && path === '/admin/patagonia-pedidos') {
      const result = await listPatagoniaPedidos(env, httpEvent.queryStringParameters ?? {});
      return jsonResponse(200, result);
    }

    if (method === 'GET' && path.startsWith('/admin/patagonia-pedidos/')) {
      const codigoParam = httpEvent.pathParameters?.codigo;
      const codigo = decodeURIComponent(
        codigoParam ?? path.slice('/admin/patagonia-pedidos/'.length),
      );

      if (!codigo) {
        return jsonResponse(400, { message: 'Missing codigo' });
      }

      const record = await getPatagoniaPedido(env, codigo);

      if (!record) {
        return jsonResponse(404, { message: 'Patagonia pedido record not found' });
      }

      const response: PatagoniaPedidoRecordResponse = {
        ...record,
        status: resolvePatagoniaPedidoStatus(record),
      };

      return jsonResponse(200, response);
    }

    if (method === 'POST' && path === '/admin/manual-sync/trigger') {
      try {
        const result = await triggerManualSync(env, {
          triggeredBy: getTriggeredBy(httpEvent),
          dryRun: parseDryRun(httpEvent.body),
        });
        return jsonResponse(202, result);
      } catch (error) {
        if (error instanceof ManualSyncConflictError) {
          return jsonResponse(409, { message: error.message });
        }
        throw error;
      }
    }

    if (method === 'POST' && path === '/admin/manual-sync/abort') {
      let runId: string | undefined;
      try {
        runId = (JSON.parse(httpEvent.body ?? '{}') as { runId?: string }).runId;
      } catch {
        runId = undefined;
      }

      if (!runId) {
        return jsonResponse(400, { message: 'Missing runId' });
      }

      try {
        const manifest = await getManualSyncRun(env, runId);
        if (manifest.status !== 'RUNNING') {
          return jsonResponse(409, { message: 'Run is not running' });
        }
        await writeAbortMarker(env.STOCK_BUCKET_NAME, `${runId}/`);
        return jsonResponse(202, { runId, aborting: true });
      } catch (error) {
        if (error instanceof ManualSyncRunError) {
          return jsonResponse(error.statusCode, { message: error.message });
        }
        throw error;
      }
    }

    if (method === 'GET' && path === '/admin/manual-sync/runs') {
      const date = httpEvent.queryStringParameters?.date;

      if (!isValidManualSyncDate(date)) {
        return jsonResponse(400, {
          message: 'Invalid or missing date query parameter. Expected YYYY-MM-DD.',
        });
      }

      const result = await listManualSyncRuns(env, date);
      return jsonResponse(200, result);
    }

    if (method === 'GET' && path.startsWith('/admin/manual-sync/runs/')) {
      const runIdParam = httpEvent.pathParameters?.runId;
      const runId = decodeURIComponent(
        runIdParam ?? path.slice('/admin/manual-sync/runs/'.length),
      );

      try {
        const manifest = await getManualSyncRun(env, runId);
        return jsonResponse(200, manifest);
      } catch (error) {
        if (error instanceof ManualSyncRunError) {
          return jsonResponse(error.statusCode, { message: error.message });
        }
        throw error;
      }
    }

    const usersResponse = await handleUsersRoutes(httpEvent, env, method, path);
    if (usersResponse) {
      return usersResponse;
    }

    return jsonResponse(404, { message: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(500, { message });
  }
}
