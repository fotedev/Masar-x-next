import 'server-only';

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import * as schema from './schema';

const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
};

let pool: Pool | null = null;
let adminDb:
  | ReturnType<typeof drizzle<typeof schema>>
  | null = null;

const getPool = (): Pool => {
  if (pool) return pool;

  pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return pool;
};

export const getAdminDb = () => {
  if (adminDb) return adminDb;
  adminDb = drizzle(getPool(), { schema });
  return adminDb;
};
