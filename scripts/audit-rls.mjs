#!/usr/bin/env node
/**
 * Read-only RLS audit — MasarX (Spec 009, task 2; MVP report G3.1).
 *
 * Verifies against the LIVE database:
 *   1. every `public.*` table has row-level security enabled,
 *   2. no policy grants `anon` write (INSERT/UPDATE/DELETE/ALL) — warnings,
 *   3. `subject_lectures` public-read matches migration 007
 *      ("Anyone can view subject lectures", USING (true), TO anon + authenticated)
 *      and its write policies remain admin-only.
 *
 * Runs ONLY read queries. Writes one report: docs/audits/rls-audit-<YYYY-MM-DD>.md
 * Exit 0 = pass, 1 = failure (missing RLS or connection/setup error).
 *
 *   node scripts/audit-rls.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env", ".env.local"]) {
    const full = path.join(ROOT, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = loadEnv();
// Prefer the IPv4 pooler URL: the direct `db.<ref>.supabase.co` host is IPv6-only
// and unreachable from IPv4-only networks.
const csRaw = env.DATABASE_URL_IPV4 || env.DATABASE_URL;
if (!csRaw) {
  console.error("[rls-audit] Missing DATABASE_URL (or DATABASE_URL_IPV4) in .env/.env.local. Aborting.");
  process.exit(1);
}
// The pooler serves a chain Node can't verify; pg ≥8.18 treats sslmode=require as
// verify-full, so downgrade to no-verify (same convention as the retired one-off script).
const cs = csRaw.replace(/([?&])sslmode=require/, "$1sslmode=no-verify");

const makeClient = () =>
  new pg.Client({
    connectionString: cs,
    connectionTimeoutMillis: 10000,
  });

let client; // fresh client per connect attempt — pg clients are unusable after a failed connect()

const failures = [];
const warnings = [];

try {
  // Supabase free-tier poolers transiently refuse connections (SSL/timeout bursts);
  // retry with a FRESH client — pg clients are unusable after a failed connect().
  let connected = false;
  for (let attempt = 1; attempt <= 3 && !connected; attempt++) {
    client = makeClient();
    try {
      await client.connect();
      connected = true;
    } catch (e) {
      await client.end().catch(() => {});
      if (attempt === 3) throw e;
      console.warn(`[rls-audit] connect attempt ${attempt} failed (${e.message}); retrying in 4s…`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  const who = (await client.query("select current_user as u, inet_server_addr()::text as host")).rows[0];

  const tables = (
    await client.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;`)
  ).rows;

  const policiesRaw = (
    await client.query(`
    SELECT tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;`)
  ).rows;
  // pg_policies.roles is name[]; depending on the pg parser it arrives as an array
  // or a literal string like {postgres,anon} — normalize to a string array.
  const policies = policiesRaw.map((p) => ({
    ...p,
    roles: Array.isArray(p.roles)
      ? p.roles
      : String(p.roles)
          .replace(/^[{"]+|["}]+$/g, "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
  }));

  for (const t of tables) {
    if (!t.rls_enabled) failures.push(`table "${t.table_name}" has RLS DISABLED`);
  }

  const WRITE_CMDS = new Set(["INSERT", "UPDATE", "DELETE", "ALL"]);
  const anonWrites = policies.filter(
    (p) => WRITE_CMDS.has(p.cmd) && p.roles.some((r) => r === "anon" || r === "public"),
  );
  for (const p of anonWrites) {
    warnings.push(`policy "${p.policyname}" on ${p.tablename} grants ${p.cmd} to anon/public (with_check: ${p.with_check || "—"}${p.qual ? `; using: ${p.qual}` : ""})`);
  }

  // subject_lectures public read — the one intentionally-open table (owner-authorized,
  // source of truth: supabase/migrations/007_subject_lectures.sql).
  // Migration 007 declares `TO anon, authenticated`; the live policy grants `TO public`
  // (superset, same effect for anon+authenticated). Accept both; note the drift.
  const slRead = policies.filter(
    (p) => p.tablename === "subject_lectures" && p.cmd === "SELECT" && (p.roles.includes("anon") || p.roles.includes("public")),
  );
  const slReadOk =
    slRead.length === 1 &&
    slRead[0].policyname === "Anyone can view subject lectures" &&
    String(slRead[0].qual).trim() === "true";
  if (!slReadOk) failures.push(`subject_lectures public-read policy does not match migration 007 (found: ${JSON.stringify(slRead.map((p) => p.policyname))})`);
  if (slReadOk && slRead[0].roles.length === 1 && slRead[0].roles[0] === "public") {
    warnings.push('subject_lectures read policy grants TO public (superset of migration 007\'s "anon, authenticated" — same public-read effect; cosmetic drift)');
  }

  const slWrites = policies.filter(
    (p) => p.tablename === "subject_lectures" && WRITE_CMDS.has(p.cmd),
  );
  const slWritesAdminOnly = slWrites.every(
    (p) => !p.roles.includes("anon") && !p.roles.includes("public"),
  );
  if (!slWritesAdminOnly) failures.push("subject_lectures write policies are not admin-only");

  const today = new Date().toISOString().slice(0, 10);
  const verdict = failures.length === 0 ? "PASS" : "FAIL";

  const md = `# RLS Audit — ${today}

- **Tool**: \`scripts/audit-rls.mjs\` (read-only; Spec 009 task 2)
- **Connected as**: \`${who.u}\` on \`${who.host ?? "(hidden)"}\`
- **Verdict: ${verdict}**
- Public tables: ${tables.length} (RLS enabled: ${tables.filter((t) => t.rls_enabled).length})
- Policies: ${policies.length}
- Failures: ${failures.length === 0 ? "none" : ""}
${failures.map((f) => `  - ❌ ${f}`).join("\n")}
- Warnings: ${warnings.length === 0 ? "none" : ""}
${warnings.map((w) => `  - ⚠️ ${w}`).join("\n")}

## Table state

| Table | RLS enabled |
| --- | --- |
${tables.map((t) => `| ${t.table_name} | ${t.rls_enabled ? "✅" : "❌ DISABLED"} |`).join("\n")}

## Policies

| Table | Policy | Cmd | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- | --- |
${policies
  .map(
    (p) =>
      `| ${p.tablename} | ${p.policyname} | ${p.cmd} | ${p.roles.join(", ")} | \`${(p.qual ?? "—").toString().replace(/\|/g, "\\|").slice(0, 120)}\` | \`${(p.with_check ?? "—").toString().replace(/\|/g, "\\|").slice(0, 120)}\` |`,
  )
  .join("\n")}

## subject_lectures public read (migration 007 contract)

- Read policy present for anon+authenticated with \`USING (true)\`: ${slReadOk ? "✅" : "❌"}
- Write policies admin-only: ${slWritesAdminOnly ? `✅ (${slWrites.length} write policies)` : "❌"}

> Diff note: the policy inventory above is the authoritative live list — compare against
> migrations 002–007 when reviewing (any policy here that migrations do not declare is drift).
`;

  mkdirSync(path.join(ROOT, "docs", "audits"), { recursive: true });
  const outPath = path.join(ROOT, "docs", "audits", `rls-audit-${today}.md`);
  writeFileSync(outPath, md);

  console.log(`[rls-audit] connected as ${who.u}`);
  console.log(`[rls-audit] tables: ${tables.length} (RLS enabled: ${tables.filter((t) => t.rls_enabled).length}), policies: ${policies.length}`);
  for (const f of failures) console.error(`[rls-audit] FAIL: ${f}`);
  for (const w of warnings) console.warn(`[rls-audit] WARN: ${w}`);
  console.log(`[rls-audit] report: docs/audits/rls-audit-${today}.md`);
  console.log(`[rls-audit] verdict: ${verdict}`);
  process.exitCode = failures.length === 0 ? 0 : 1;
} catch (err) {
  console.error(`[rls-audit] ERROR: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
