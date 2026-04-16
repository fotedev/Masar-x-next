import 'server-only';

import dns from 'node:dns';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import * as schema from './schema';

dns.setDefaultResultOrder('ipv4first');

const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL_IPV4 || process.env.DATABASE_URL;
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

  const url = getDatabaseUrl();
  const parsedUrl = new URL(url);

  const host = process.env.DATABASE_HOST || parsedUrl.hostname;
  const port = parseInt(process.env.DATABASE_PORT || parsedUrl.port || '5432');

  const projectRef = parsedUrl.hostname.startsWith('db.')
    ? parsedUrl.hostname.split('.')[1]
    : undefined;

  const user =
    host.includes('pooler.supabase.com') && projectRef && !parsedUrl.username.includes('.')
      ? `${parsedUrl.username}.${projectRef}`
      : parsedUrl.username;

  pool = new Pool({
    host,
    port,
    user,
    password: decodeURIComponent(parsedUrl.password),
    database: parsedUrl.pathname.slice(1),
    ssl: {
      rejectUnauthorized: false, // Silence pg warning and allow self-signed certs common in DB-as-a-service
    },
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
};

export const getAdminDb = () => {
  if (adminDb) return adminDb;
  adminDb = drizzle(getPool(), { schema });
  return adminDb;
};
