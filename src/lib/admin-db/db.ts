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

  // Warn at startup when a direct connection URL is used on an IPv4-only host.
  // The direct host (db.PROJECT.supabase.co) is IPv6-only; the Session Pooler
  // (aws-0-REGION.pooler.supabase.com:5432) is IPv4-compatible.
  if (!process.env.DATABASE_URL_IPV4) {
    try {
      const { hostname } = new URL(url);
      if (hostname.startsWith("db.") && hostname.endsWith(".supabase.co")) {
        logger.warn(
          "[admin-db] DATABASE_URL points to the Supabase direct connection " +
            `(${hostname}), which is IPv6-only. If you are on an IPv4-only network ` +
            "(e.g. WSL2 on Windows), queries will fail with ENETUNREACH. " +
            "Fix: set DATABASE_URL_IPV4 in .env.local to the Session Pooler URI " +
            "(Supabase Dashboard → Settings → Database → Connection Pooling, port 5432).",
          { hostname },
        );
      }
    } catch {
      // URL parse failed — getDatabaseUrl will throw below when the pool tries to connect
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
    if (err.code === "ENETUNREACH") {
      logger.error(
        "[admin-db] ENETUNREACH — cannot reach the database host. " +
          "The direct connection (db.*.supabase.co:5432) is IPv6-only. " +
          "Set DATABASE_URL_IPV4 in .env.local to the Session Pooler URI " +
          "(Supabase Dashboard → Settings → Database → Connection Pooling, Session Mode, port 5432).",
        err,
        {
          address: (err as NodeJS.ErrnoException & { address?: string })
            .address,
          port: (err as NodeJS.ErrnoException & { port?: number }).port,
        },
      );
    } else {
      logger.error("[admin-db] Unexpected error on idle client", err);
    }
  });

  return pool;
};

export const getAdminDb = () => {
  if (adminDb) return adminDb;
  adminDb = drizzle(getPool(), { schema });
  return adminDb;
};
