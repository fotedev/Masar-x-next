// scripts/db-diagnose.cjs
// Run with: npm run db:diagnose
// Prints connection status, whether `profiles` table exists, and missing columns.

const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

require("dotenv").config({ path: ".env.local" });

const { Client } = require("pg");

const url =
  process.env.DATABASE_URL_IPV4 ||
  process.env.DATABASE_URL;

if (!url) {
  console.error("[FATAL] DATABASE_URL_IPV4 or DATABASE_URL must be set in .env.local");
  process.exit(1);
}

const REQUIRED_COLUMNS = [
  "id",
  "updated_at",
  "username",
  "full_name",
  "avatar_url",
  "website",
  "level",
  "semester",
  "department_id",
  "show_extra_assets",
  "show_extra_assets_updated_at",
];

(async () => {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log("[1/3] Connecting to", new URL(url).hostname, "...");
    await client.connect();
    console.log("       OK\n");

    console.log("[2/3] Checking if `profiles` table exists ...");
    const tableRes = await client.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_name = $1`,
      ["profiles"],
    );
    if (tableRes.rowCount === 0) {
      console.error("       MISSING — `profiles` table does not exist in this database.");
      console.error("       Fix: run your migrations (e.g. `npm run db:push` or apply the SQL in supabase/migrations).");
      process.exit(2);
    }
    const { table_schema, table_name } = tableRes.rows[0];
    console.log(`       Found ${table_schema}.${table_name}\n`);

    console.log("[3/3] Checking columns ...");
    const colsRes = await client.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2`,
      [table_schema, table_name],
    );
    const existing = new Set(colsRes.rows.map((r) => r.column_name));
    const missing = REQUIRED_COLUMNS.filter((c) => !existing.has(c));
    const extra = [...existing].filter((c) => !REQUIRED_COLUMNS.includes(c));

    console.log("       Existing columns:");
    for (const row of colsRes.rows) {
      console.log(`         - ${row.column_name} (${row.data_type}, nullable=${row.is_nullable})`);
    }
    console.log();
    if (missing.length > 0) {
      console.error("       MISSING columns:", missing.join(", "));
      console.error("       Fix: add the missing columns or run migrations.");
      process.exit(3);
    } else {
      console.log("       All required columns present.");
    }
    if (extra.length > 0) {
      console.log("       Extra columns (harmless):", extra.join(", "));
    }
    console.log("\n[OK] Schema looks compatible with src/lib/admin-db/schema.ts");
  } catch (err) {
    console.error("\n[ERROR]", err.code || err.name, "-", err.message);
    if (err.code === "ENETUNREACH" || err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      console.error("       Network-level error — DB host not reachable from this machine.");
    } else if (err.code === "28P01") {
      console.error("       Authentication failed — check username/password in DATABASE_URL.");
    } else if (err.code === "42501") {
      console.error("       Permission denied — the role lacks SELECT on this table.");
    }
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
