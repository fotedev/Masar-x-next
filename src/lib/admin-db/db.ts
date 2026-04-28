import "server-only";

import dns from "node:dns";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";
import { logger } from "@/lib/logger";

dns.setDefaultResultOrder("ipv4first");

const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL_IPV4 || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add DATABASE_URL (direct connection) or " +
        "DATABASE_URL_IPV4 (Session Pooler — required on IPv4-only hosts such as WSL2) to .env.local.",
    );
  }

  // Warn when a direct connection URL is used.
  // The direct host (db.PROJECT.supabase.co) is IPv6-only; the Session Pooler
  // (aws-0-REGION.pooler.supabase.com:5432) is IPv4-compatible.
  if (!process.env.DATABASE_URL_IPV4 && url) {
    try {
      const { hostname } = new URL(url);
      if (hostname.startsWith("db.") && hostname.endsWith(".supabase.co")) {
        const isProduction = process.env.NODE_ENV === "production";
        const warnPrefix = isProduction ? "[CRITICAL/admin-db] PRODUCTION WARNING: " : "[admin-db] ";
        
        logger.warn(
          `${warnPrefix}DATABASE_URL points to the Supabase direct connection ` +
            `(${hostname}), which is IPv6-only. This WILL fail on IPv4-only networks ` +
            "(like Vercel, WSL2, or many cloud providers) with ENETUNREACH. " +
            "Fix: use the Session Pooler URI (port 5432) and set it as DATABASE_URL_IPV4.",
          { hostname, environment: process.env.NODE_ENV },
        );
      }
    } catch {
      // URL parse failed
    }
  }

  return url;
};

let pool: Pool | null = null;
let adminDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

const getPool = (): Pool => {
  if (pool) return pool;

  const url = getDatabaseUrl();
  const parsedUrl = new URL(url);

  const host = process.env.DATABASE_HOST || parsedUrl.hostname;
  const port = parseInt(process.env.DATABASE_PORT || parsedUrl.port || "5432");

  const projectRef = parsedUrl.hostname.startsWith("db.")
    ? parsedUrl.hostname.split(".")[1]
    : undefined;

  const user =
    host.includes("pooler.supabase.com") &&
    projectRef &&
    !parsedUrl.username.includes(".")
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

  pool.on("error", (err: NodeJS.ErrnoException) => {
    const isProduction = process.env.NODE_ENV === "production";
    const logPrefix = isProduction ? "[CRITICAL/admin-db] " : "[admin-db] ";

    if (err.code === "ENETUNREACH") {
      logger.error(
        `${logPrefix}ENETUNREACH — cannot reach the database host. ` +
          "The direct connection (db.*.supabase.co:5432) is IPv6-only. " +
          "ACTION REQUIRED: Use the Session Pooler URI (port 5432) in DATABASE_URL_IPV4.",
        err,
        {
          address: (err as NodeJS.ErrnoException & { address?: string }).address,
          port: (err as NodeJS.ErrnoException & { port?: number }).port,
          isProduction
        },
      );
    } else {
      logger.error(`${logPrefix}Unexpected error on idle client`, err);
    }
  });

  return pool;
};

export const getAdminDb = () => {
  if (adminDb) return adminDb;
  adminDb = drizzle(getPool(), { schema });
  return adminDb;
};
