// db-seed.mjs — applies supabase/seed.sql to the database from DATABASE_URL.
// Mirrors src/lib/admin-db/db.ts env resolution (DATABASE_URL_IPV4 wins so the
// Session Pooler is used on IPv4-only hosts). Idempotent: seed.sql uses
// ON CONFLICT DO NOTHING throughout, so re-running is safe.
//
// Usage: pnpm db:seed   (from the repo root)

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import pg from "pg";

dns.setDefaultResultOrder("ipv4first");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, "../../../supabase/seed.sql");
const sql = readFileSync(sqlPath, "utf8");

const connectionString =
  process.env.DATABASE_URL_IPV4 || process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[db:seed] DATABASE_URL is not set. Copy .env.example to .env.local and fill in DATABASE_URL (or DATABASE_URL_IPV4 for IPv4-only hosts).",
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  console.log("[db:seed] Seed data applied (levels, departments, settings, sample subjects & lectures).");
} catch (error) {
  console.error("[db:seed] Failed to apply seed data:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
