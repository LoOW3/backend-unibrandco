import type { APIGatewayProxyResultV2 } from 'aws-lambda';

import { jsonResponse } from '../http-response';
import { parseLimit } from '../pagination';
import type { AdminApiEnv } from '../types';
import { query } from './db';

type QueryParams = Record<string, string | undefined>;

interface NamedTotal {
  label: string;
  total: number;
}

/** Offset-based cursor (base64url) — Postgres has no DynamoDB LastEvaluatedKey. */
function decodeOffset(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  try {
    const parsed = Number.parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
    return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
  } catch {
    return 0;
  }
}

function encodeOffset(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

/** Builds an optional WHERE from equality filters; returns clause + params. */
function buildWhere(filters: Array<[string, string | undefined]>): {
  where: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];
  for (const [column, value] of filters) {
    if (value) {
      params.push(value);
      conditions.push(`${column} = $${params.length}`);
    }
  }
  return { where: conditions.length ? `where ${conditions.join(' and ')}` : '', params };
}

async function goldSummary(env: AdminApiEnv, qs: QueryParams) {
  const { where, params } = buildWhere([
    ['canal', qs.canal],
    ['mes_comercial', qs.mes],
  ]);

  const [totals, porCanal, porMes, topMarcas, topClientes] = await Promise.all([
    query<{ ventasTotales: number; margenTotal: number; unidadesTotales: number }>(
      env,
      `select coalesce(sum(precio_neto * cantidad), 0)::float8 as "ventasTotales",
              coalesce(sum(margen_total), 0)::float8 as "margenTotal",
              coalesce(sum(cantidad), 0)::float8 as "unidadesTotales"
       from gold.fact_ventas ${where}`,
      params,
    ),
    query<NamedTotal>(
      env,
      `select coalesce(canal, '—') as label, coalesce(sum(precio_neto * cantidad), 0)::float8 as total
       from gold.fact_ventas ${where}
       group by canal order by total desc nulls last`,
      params,
    ),
    query<NamedTotal>(
      env,
      `select coalesce(mes_comercial, '—') as label, coalesce(sum(precio_neto * cantidad), 0)::float8 as total
       from gold.fact_ventas ${where}
       group by mes_comercial order by mes_comercial`,
      params,
    ),
    query<NamedTotal>(
      env,
      `select coalesce(marca, '—') as label, coalesce(sum(precio_neto * cantidad), 0)::float8 as total
       from gold.fact_ventas ${where}
       group by marca order by total desc nulls last limit 10`,
      params,
    ),
    query<NamedTotal>(
      env,
      `select coalesce(cliente, '—') as label, coalesce(sum(precio_neto * cantidad), 0)::float8 as total
       from gold.fact_ventas ${where}
       group by cliente order by total desc nulls last limit 10`,
      params,
    ),
  ]);

  const summary = totals[0] ?? { ventasTotales: 0, margenTotal: 0, unidadesTotales: 0 };

  return {
    ventasTotales: summary.ventasTotales,
    margenTotal: summary.margenTotal,
    unidadesTotales: summary.unidadesTotales,
    ventasPorCanal: porCanal,
    ventasPorMes: porMes,
    topMarcas,
    topClientes,
  };
}

async function goldVentas(env: AdminApiEnv, qs: QueryParams) {
  const limit = parseLimit(qs.limit);
  const offset = decodeOffset(qs.cursor);
  const { where, params } = buildWhere([
    ['canal', qs.canal],
    ['mes_comercial', qs.mes],
    ['marca', qs.marca],
  ]);

  params.push(limit + 1);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const rows = await query<Record<string, unknown>>(
    env,
    `select canal, unidad, tipo,
            nro_orden::text as "nroOrden",
            to_char(fecha, 'YYYY-MM-DD') as fecha,
            mes_comercial as "mesComercial",
            sku, producto,
            cantidad::float8 as cantidad,
            precio_unitario::float8 as "precioUnitario",
            precio_neto::float8 as "precioNeto",
            costo_unitario::float8 as "costoUnitario",
            comision::float8 as comision,
            envio::float8 as envio,
            margen_total::float8 as "margenTotal",
            marca, cliente
     from gold.fact_ventas
     ${where}
     order by fecha desc nulls last, nro_orden, sku
     limit $${limitIdx} offset $${offsetIdx}`,
    params,
  );

  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? encodeOffset(offset + limit) : null };
}

async function goldClientes(env: AdminApiEnv, qs: QueryParams) {
  const limit = parseLimit(qs.limit);
  const offset = decodeOffset(qs.cursor);
  const { where, params } = buildWhere([['categoria', qs.categoria]]);

  params.push(limit + 1);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const rows = await query<Record<string, unknown>>(
    env,
    `select cliente_id as "clienteId",
            nombre, rubro, provincia, localidad, zona, email,
            promedio_mensual_3m::float8 as "promedioMensual3m",
            meses_con_compra_3m::int as "mesesConCompra3m",
            monto_total_3m::float8 as "montoTotal3m",
            compra_facturado as "compraFacturado",
            compra_no_facturado as "compraNoFacturado",
            categoria
     from gold.clientes_clasificados
     ${where}
     order by categoria, monto_total_3m desc nulls last
     limit $${limitIdx} offset $${offsetIdx}`,
    params,
  );

  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? encodeOffset(offset + limit) : null };
}

async function goldFletes(env: AdminApiEnv, qs: QueryParams) {
  const limit = parseLimit(qs.limit);
  const offset = decodeOffset(qs.cursor);

  const rows = await query<Record<string, unknown>>(
    env,
    `select nro_orden as "nroOrden",
            sku,
            clave_fila as "claveFila",
            flete_prorrateado::float8 as "fleteProrrateado",
            tiene_flete_real as "tieneFleteReal",
            fecha_calculo as "fechaCalculo"
     from gold.fact_ventas_flete
     order by fecha_calculo desc nulls last
     limit $1 offset $2`,
    [limit + 1, offset],
  );

  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? encodeOffset(offset + limit) : null };
}

/**
 * Handles /admin/gold/* routes (datos finales limpiados — esquema gold en
 * Postgres/Supabase). Returns null when the path is not a gold route so the
 * main handler continues. ADMIN gating is already enforced by the base handler.
 */
export async function handleGoldRoutes(
  env: AdminApiEnv,
  method: string,
  path: string,
  qs: QueryParams,
): Promise<APIGatewayProxyResultV2 | null> {
  if (!path.startsWith('/admin/gold/')) {
    return null;
  }
  if (method !== 'GET') {
    return jsonResponse(405, { message: 'Method not allowed' });
  }

  switch (path) {
    case '/admin/gold/summary':
      return jsonResponse(200, await goldSummary(env, qs));
    case '/admin/gold/ventas':
      return jsonResponse(200, await goldVentas(env, qs));
    case '/admin/gold/clientes':
      return jsonResponse(200, await goldClientes(env, qs));
    case '/admin/gold/fletes':
      return jsonResponse(200, await goldFletes(env, qs));
    default:
      return jsonResponse(404, { message: 'Not found' });
  }
}
