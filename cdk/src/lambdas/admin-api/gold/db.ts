import { Pool } from 'pg';

import type { AdminApiEnv } from '../types';

// Module-scoped pool reused across warm invocations. Small max — Lambda
// concurrency multiplies connections and Supabase caps them.
let pool: Pool | undefined;

function getPool(env: AdminApiEnv): Pool {
  if (!pool) {
    pool = new Pool({
      host: env.DB_HOST,
      port: Number.parseInt(env.DB_PORT, 10) || 5432,
      user: env.DB_USER,
      password: env.DB_PASS,
      database: env.DB_NAME,
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      // Supabase requires TLS; the pooler cert chain is not in the Lambda trust store.
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

/** Runs a parameterized query and returns typed rows. */
export async function query<T>(env: AdminApiEnv, text: string, params?: unknown[]): Promise<T[]> {
  const result = await getPool(env).query(text, params);
  return result.rows as T[];
}
