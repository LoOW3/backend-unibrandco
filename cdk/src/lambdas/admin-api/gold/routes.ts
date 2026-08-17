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
            ticket_promedio::float8 as "ticketPromedio",
            cantidad_tickets::int as "cantidadTickets",
            monto_total::float8 as "montoTotal",
            compra_0001 as "compraFacturado",
            compra_0003 as "compraNoFacturado",
            categoria
     from gold.clientes_clasificados
     ${where}
     order by categoria, monto_total desc nulls last
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
 * Igual que buildWhere, pero fija dos condiciones siempre presentes para
 * el tablero "Ventas mayoristas": solo canal Mayorista, y excluye el
 * vendedor "AGENCIA" (no es un vendedor de planta, distorsiona los KPIs
 * de rendimiento comercial). Las columnas base no se alias-prefijan
 * (fact_ventas.columna) para poder reutilizar el mismo WHERE tanto en
 * queries simples como en las que hacen JOIN con otras tablas.
 */
function buildWhereVentasMayoristas(filters: Array<[string, string | undefined]>): {
  where: string;
  params: unknown[];
} {
  const conditions: string[] = ["canal = 'Mayorista'", "coalesce(vendedor, '') <> 'AGENCIA'"];
  const params: unknown[] = [];
  for (const [column, value] of filters) {
    if (value) {
      params.push(value);
      conditions.push(`${column} = $${params.length}`);
    }
  }
  return { where: `where ${conditions.join(' and ')}`, params };
}

async function goldVentasMayoristas(env: AdminApiEnv, qs: QueryParams) {
  const { where, params } = buildWhereVentasMayoristas([
    ['vendedor', qs.vendedor],
    ['empresa', qs.empresa],
    ['mes_comercial', qs.mes],
  ]);

  const [totales, top10, porProveedor, margenPorProveedor, porDiaVendedor, flete] = await Promise.all([
    // Totales + margen ajustado por flete de proveedores (ver tabla
    // gold.fletes_proveedores_pct_mensual — el % del mes ANTERIOR se resta
    // del costo de cada línea; si no hay dato cargado para ese proveedor/mes,
    // coalesce a 0 y no afecta el cálculo).
    query<{
      facturacionNeta: number;
      costoMercaderia: number;
      unidades: number;
      margenTotal: number;
      margenAjustado: number;
      clientesConCompra: number;
      cantidadPedidos: number;
    }>(
      env,
      `select coalesce(sum(gold.fact_ventas.precio_neto * gold.fact_ventas.cantidad), 0)::float8 as "facturacionNeta",
              coalesce(sum(gold.fact_ventas.costo_unitario * gold.fact_ventas.cantidad), 0)::float8 as "costoMercaderia",
              coalesce(sum(gold.fact_ventas.cantidad), 0)::float8 as "unidades",
              coalesce(sum(gold.fact_ventas.margen_total), 0)::float8 as "margenTotal",
              coalesce(
                sum(gold.fact_ventas.margen_total)
                  - sum(gold.fact_ventas.costo_unitario * gold.fact_ventas.cantidad * coalesce(fpm.pct_flete, 0)),
                0
              )::float8 as "margenAjustado",
              count(distinct gold.fact_ventas.cliente) as "clientesConCompra",
              count(distinct gold.fact_ventas.nro_orden) as "cantidadPedidos"
       from gold.fact_ventas
       left join gold.fletes_proveedores_pct_mensual fpm
         on gold.fact_ventas.proveedor = fpm.proveedor
        and gold.fact_ventas.mes_comercial = fpm.mes_aplicable
       ${where}`,
      params,
    ),
    // % de facturación concentrado en los 10 clientes más grandes.
    query<{ totalGeneral: number; totalTop10: number }>(
      env,
      `with base as (
         select gold.fact_ventas.cliente as cliente,
                sum(gold.fact_ventas.precio_neto * gold.fact_ventas.cantidad) as total
         from gold.fact_ventas
         ${where} and gold.fact_ventas.cliente is not null
         group by gold.fact_ventas.cliente
       )
       select coalesce((select sum(total) from base), 0)::float8 as "totalGeneral",
              coalesce((select sum(total) from (select total from base order by total desc nulls last limit 10) t), 0)::float8 as "totalTop10"`,
      params,
    ),
    // Facturación neta por proveedor (para el gráfico de torta).
    query<NamedTotal>(
      env,
      `select coalesce(gold.fact_ventas.proveedor, '—') as label,
              coalesce(sum(gold.fact_ventas.precio_neto * gold.fact_ventas.cantidad), 0)::float8 as total
       from gold.fact_ventas
       ${where}
       group by gold.fact_ventas.proveedor
       order by total desc nulls last
       limit 12`,
      params,
    ),
    // Margen % por proveedor, ya con el ajuste de flete aplicado (mismo
    // criterio que "margenAjustado" arriba, pero desglosado por proveedor).
    // Se excluyen proveedores con menos de 20 unidades vendidas en el
    // período filtrado, para no mezclar casos de bajo volumen que
    // distorsionan el % (ver el caso "AGENCIA PROVEEDORES" sin costo real).
    query<{ label: string; margenPct: number; unidades: number }>(
      env,
      `select gold.fact_ventas.proveedor as label,
              case when sum(gold.fact_ventas.precio_neto * gold.fact_ventas.cantidad) = 0 then 0
                   else (
                     sum(gold.fact_ventas.margen_total)
                       - sum(gold.fact_ventas.costo_unitario * gold.fact_ventas.cantidad * coalesce(fpm.pct_flete, 0))
                   ) / sum(gold.fact_ventas.precio_neto * gold.fact_ventas.cantidad)
              end::float8 as "margenPct",
              coalesce(sum(gold.fact_ventas.cantidad), 0)::float8 as unidades
       from gold.fact_ventas
       left join gold.fletes_proveedores_pct_mensual fpm
         on gold.fact_ventas.proveedor = fpm.proveedor
        and gold.fact_ventas.mes_comercial = fpm.mes_aplicable
       ${where} and gold.fact_ventas.proveedor is not null
       group by gold.fact_ventas.proveedor
       having sum(gold.fact_ventas.cantidad) >= 20
       order by "margenPct" desc
       limit 15`,
      params,
    ),
    // Facturación por día y vendedor (para el gráfico de líneas múltiples).
    query<{ fecha: string; vendedor: string; total: number }>(
      env,
      `select to_char(gold.fact_ventas.fecha, 'YYYY-MM-DD') as fecha,
              coalesce(gold.fact_ventas.vendedor, '—') as vendedor,
              coalesce(sum(gold.fact_ventas.precio_neto * gold.fact_ventas.cantidad), 0)::float8 as total
       from gold.fact_ventas
       ${where}
       group by gold.fact_ventas.fecha, gold.fact_ventas.vendedor
       order by gold.fact_ventas.fecha`,
      params,
    ),
    // Flete real (facturas reales del transportista) vs estimado
    // (prorrateo cuando todavía no llegó la factura real).
    query<{ fleteTotalReal: number; fleteEstimadoFiltrado: number }>(
      env,
      `select coalesce(sum(fvf.flete_prorrateado) filter (where fvf.tiene_flete_real = true), 0)::float8 as "fleteTotalReal",
              coalesce(
                sum(fvf.flete_prorrateado) filter (where coalesce(fvf.tiene_flete_real, false) = false),
                0
              )::float8 as "fleteEstimadoFiltrado"
       from gold.fact_ventas
       left join gold.fact_ventas_flete fvf
         on gold.fact_ventas.nro_orden::text = fvf.nro_orden
        and gold.fact_ventas.sku = fvf.sku
       ${where}`,
      params,
    ),
  ]);

  const t = totales[0] ?? {
    facturacionNeta: 0,
    costoMercaderia: 0,
    unidades: 0,
    margenTotal: 0,
    margenAjustado: 0,
    clientesConCompra: 0,
    cantidadPedidos: 0,
  };
  const top10Row = top10[0] ?? { totalGeneral: 0, totalTop10: 0 };
  const fleteRow = flete[0] ?? { fleteTotalReal: 0, fleteEstimadoFiltrado: 0 };

  return {
    facturacionNeta: t.facturacionNeta,
    costoMercaderia: t.costoMercaderia,
    unidades: t.unidades,
    margenTotal: t.margenTotal,
    margenAjustado: t.margenAjustado,
    clientesConCompra: t.clientesConCompra,
    ticketPromedio: t.cantidadPedidos > 0 ? t.facturacionNeta / t.cantidadPedidos : 0,
    pctRentabilidadAjustada: t.facturacionNeta > 0 ? t.margenAjustado / t.facturacionNeta : 0,
    pctFacturacionTop10Clientes: top10Row.totalGeneral > 0 ? top10Row.totalTop10 / top10Row.totalGeneral : 0,
    fleteTotalReal: fleteRow.fleteTotalReal,
    fleteEstimadoFiltrado: fleteRow.fleteEstimadoFiltrado,
    facturacionPorProveedor: porProveedor,
    margenPctPorProveedor: margenPorProveedor,
    facturacionPorDiaVendedor: porDiaVendedor,
  };
}


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
    case '/admin/gold/ventas-mayoristas':
      return jsonResponse(200, await goldVentasMayoristas(env, qs));
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
