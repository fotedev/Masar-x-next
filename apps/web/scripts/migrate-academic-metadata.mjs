#!/usr/bin/env node
/**
 * T037 - migrate-academic-metadata.mjs
 *
 * One-off data migration: copies academic data stored in auth.users.user_metadata
 * into public.profiles, using the same mapping the OnboardingModal performs in
 * the browser:
 *
 *   user_metadata.academic_level (level NAME) -> academic_levels.level_number -> profiles.level
 *   user_metadata.department     (dept NAME)  -> departments.id              -> profiles.department_id
 *
 * Env (read from process.env; never hardcoded, never printed):
 *   SUPABASE_SERVICE_ROLE_KEY - service-role key (required)
 *   NEXT_PUBLIC_SUPABASE_URL  - project URL (required; SUPABASE_URL accepted as fallback)
 *   If missing, apps/web/.env.local (then repo-root .env.local / .env) is loaded
 *   for any keys still unset.
 *
 * Usage:
 *   node scripts/migrate-academic-metadata.mjs           # dry-run (default, writes nothing)
 *   node scripts/migrate-academic-metadata.mjs --apply   # perform the profiles upserts
 *
 * Only profiles columns id, level, department_id, updated_at are touched
 * (semester and every other column are left unchanged).
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..', '..');

const APPLY = process.argv.includes('--apply');

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(webRoot, '.env.local'));
loadEnvFile(path.join(webRoot, '.env'));
loadEnvFile(path.join(repoRoot, '.env.local'));
loadEnvFile(path.join(repoRoot, '.env'));

const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ''
).replace(/\/+$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY and/or NEXT_PUBLIC_SUPABASE_URL.',
  );
  console.error(
    'Set them in the environment or in apps/web/.env.local (values are read, never printed).',
  );
  process.exit(1);
}

const authHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

async function restGet(table, select) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`,
    { headers: { ...authHeaders } },
  );
  if (!res.ok) throw new Error(`GET ${table} failed: HTTP ${res.status}`);
  return res.json();
}

async function upsertProfile(payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`profiles upsert failed: HTTP ${res.status} ${detail}`);
  }
}

async function listAuthUsers() {
  const perPage = 200;
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: { ...authHeaders } },
    );
    if (!res.ok) throw new Error(`admin users list failed: HTTP ${res.status}`);
    const json = await res.json();
    const batch = Array.isArray(json) ? json : json.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
  }
  return users;
}

async function main() {
  console.log(
    `Mode: ${APPLY ? 'APPLY (writes profiles rows)' : 'DRY-RUN (no writes; pass --apply to write)'}`,
  );

  const [levels, departments] = await Promise.all([
    restGet('academic_levels', 'id,name,level_number'),
    restGet('departments', 'id,name'),
  ]);
  const levelNumberByName = new Map(
    levels.map((l) => [String(l.name).trim(), l.level_number]),
  );
  const departmentIdByName = new Map(
    departments.map((d) => [String(d.name).trim(), d.id]),
  );
  console.log(
    `Loaded ${levels.length} academic level(s) and ${departments.length} department(s) for name mapping.`,
  );

  const users = await listAuthUsers();
  const stats = {
    totalUsers: users.length,
    withMetadata: 0,
    planned: 0,
    written: 0,
    unmapped: 0,
    nothingToWrite: 0,
    errors: 0,
  };

  for (const user of users) {
    const meta = user.user_metadata || {};
    const levelName =
      typeof meta.academic_level === 'string' ? meta.academic_level.trim() : '';
    const deptName =
      typeof meta.department === 'string' ? meta.department.trim() : '';
    if (!levelName && !deptName) continue;
    stats.withMetadata += 1;

    const payload = { id: user.id, updated_at: new Date().toISOString() };
    const problems = [];
    if (levelName) {
      const levelNumber = levelNumberByName.get(levelName);
      if (levelNumber === undefined) {
        problems.push(
          `academic_level "${levelName}" not found in academic_levels`,
        );
      } else {
        payload.level = levelNumber;
      }
    }
    if (deptName) {
      const deptId = departmentIdByName.get(deptName);
      if (!deptId) {
        problems.push(`department "${deptName}" not found in departments`);
      } else {
        payload.department_id = deptId;
      }
    }

    if (problems.length > 0) {
      stats.unmapped += 1;
      for (const p of problems) console.warn(`WARN user ${user.id}: ${p}`);
    }
    if (Object.keys(payload).length <= 2) {
      stats.nothingToWrite += 1;
      continue;
    }

    const label = `level=${payload.level ?? '-'} department_id=${payload.department_id ?? '-'}`;
    if (APPLY) {
      try {
        await upsertProfile(payload);
        stats.written += 1;
        console.log(`OK  user ${user.id}: ${label}`);
      } catch (err) {
        stats.errors += 1;
        console.error(`ERR user ${user.id}: ${err.message}`);
      }
    } else {
      stats.planned += 1;
      console.log(`PLAN user ${user.id}: ${label}`);
    }
  }

  console.log('\n==== Summary ====');
  console.log(`mode:               ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`auth users scanned: ${stats.totalUsers}`);
  console.log(`with metadata:      ${stats.withMetadata}`);
  console.log(
    APPLY
      ? `profiles upserted:  ${stats.written}`
      : `upserts planned:    ${stats.planned}`,
  );
  console.log(`unmapped names:     ${stats.unmapped}`);
  console.log(`nothing to write:   ${stats.nothingToWrite}`);
  console.log(`errors:             ${stats.errors}`);

  if (stats.errors > 0) process.exitCode = 1;
}

await main();