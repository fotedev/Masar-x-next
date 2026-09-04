// Modes:
//   node scripts/auth-route-check.mjs [baseUrl]   -> live redirect checks for protected pages (default)
//   node scripts/auth-route-check.mjs --scan-api  -> static scan of src/app/api/**/route.ts:
//                                                    0 occurrences of getSession( allowed (getUser required).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const scanApi = args.includes('--scan-api');
const baseUrl = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000';

// T046: static scan mode. API routes must authenticate with getUser(), never getSession().
function scanApiRoutes() {
  const apiDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'src',
    'app',
    'api',
  );
  if (!existsSync(apiDir)) {
    console.error(`API directory not found: ${apiDir}`);
    return 1;
  }

  const routeFiles = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name === 'route.ts') {
        routeFiles.push(full);
      }
    }
  };
  walk(apiDir);

  const offenders = [];
  for (const file of routeFiles) {
    const rel = path.relative(process.cwd(), file) || file;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (/getSession\s*\(/.test(line)) offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
    });
  }

  console.log(`Scanned ${routeFiles.length} API route.ts file(s) under src/app/api.`);
  if (offenders.length > 0) {
    console.error(`\n${offenders.length} getSession( occurrence(s) found - API routes must use getUser():`);
    for (const o of offenders) console.error(`  BAD ${o}`);
    return 1;
  }
  console.log('OK: 0 occurrences of getSession(.');
  return 0;
}

if (scanApi) {
  process.exit(scanApiRoutes());
}

const routesToCheck = [
  '/',
  '/login',
  '/admin-dashboard',
  '/admin',
  '/non-academic',
  '/profile',
  '/quiz-attempts',
  '/add-summary',
  '/add-video',
  '/add-file',
  '/ar/admin-dashboard',
  '/ar/admin',
  '/ar/non-academic',
  '/ar/profile',
  '/ar/quiz-attempts',
  '/ar/add-summary',
  '/ar/add-video',
  '/ar/add-file',
  '/en/admin-dashboard',
  '/en/admin',
  '/en/non-academic',
  '/en/profile',
  '/en/quiz-attempts',
  '/en/add-summary',
  '/en/add-video',
  '/en/add-file',
];

function joinUrl(base, path) {
  const u = new URL(base);
  u.pathname = path;
  u.search = '';
  u.hash = '';
  return u.toString();
}

function expectedLoginRedirect(path) {
  if (path.startsWith('/ar/')) return '/ar/login';
  if (path.startsWith('/en/')) return '/en/login';
  // No locale in path: Next-intl may redirect first to a default locale.
  // We validate protected redirects by following a small number of redirects.
  return '/ar/login';
}

function isProtected(path) {
  const withoutLocale = path.replace(/^\/(ar|en)(?=\/|$)/, '');
  if (withoutLocale.startsWith('/non-academic')) return true;
  if (withoutLocale.startsWith('/admin') || withoutLocale.startsWith('/admin-dashboard')) return true;
  return [
    '/profile',
    '/quiz-attempts',
    '/add-summary',
    '/add-video',
    '/add-file',
  ].some((r) => withoutLocale.startsWith(r));
}

async function checkRoute(path) {
  const protectedRoute = isProtected(path);
  const expectedLocation = protectedRoute ? expectedLoginRedirect(path) : null;

  let currentUrl = joinUrl(baseUrl, path);
  let lastStatus = null;
  let lastLocation = null;
  const visited = [];

  // Follow a few redirects manually so we can tolerate:
  // - next-intl locale redirects (e.g. /profile -> /ar/profile)
  // - internal canonical redirects (e.g. /admin -> /admin-dashboard)
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(currentUrl, {
      redirect: 'manual',
      headers: {
        // Make it explicit we are running a synthetic test
        'user-agent': 'auth-route-check/1.0',
      },
    });

    lastStatus = res.status;
    lastLocation = res.headers.get('location');
    visited.push({ url: currentUrl, status: res.status, location: lastLocation });

    const isRedirect = res.status >= 300 && res.status < 400 && typeof lastLocation === 'string';
    if (!isRedirect) break;

    // Resolve relative redirects safely
    currentUrl = new URL(lastLocation, currentUrl).toString();
  }

  const final = visited[visited.length - 1] ?? { url: currentUrl, status: lastStatus, location: lastLocation };
  const finalLocation = final.location;
  const finalStatus = final.status;

  const ok = protectedRoute
    ? visited.some((v) => typeof v.location === 'string' && v.location.endsWith(expectedLocation))
    : typeof finalStatus === 'number' && finalStatus >= 200 && finalStatus < 400;

  return {
    path,
    url: joinUrl(baseUrl, path),
    status: finalStatus,
    location: finalLocation,
    protectedRoute,
    expectedLocation,
    ok,
    chain: visited,
  };
}

const results = [];
for (const path of routesToCheck) {
  try {
    // eslint-disable-next-line no-await-in-loop
    results.push(await checkRoute(path));
  } catch (err) {
    results.push({
      path,
      url: joinUrl(baseUrl, path),
      status: 'FETCH_ERROR',
      location: null,
      protectedRoute: isProtected(path),
      expectedLocation: isProtected(path) ? expectedLoginRedirect(path) : null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

const failing = results.filter((r) => !r.ok);

for (const r of results) {
  const status = String(r.status).padEnd(11, ' ');
  const protectedFlag = r.protectedRoute ? 'protected' : 'public   ';
  const outcome = r.ok ? 'OK ' : 'BAD';
  const loc = r.location ? ` -> ${r.location}` : '';
  console.log(`${outcome} ${status} ${protectedFlag} ${r.path}${loc}`);
  if (!r.ok && r.error) console.log(`     error: ${r.error}`);
  if (!r.ok && r.protectedRoute) {
    console.log(`     expected redirect suffix: ${r.expectedLocation}`);
    if (Array.isArray(r.chain)) {
      for (const step of r.chain) {
        const stepLoc = step.location ? ` -> ${step.location}` : '';
        console.log(`     chain: ${step.status} ${new URL(step.url).pathname}${stepLoc}`);
      }
    }
  }
}

if (failing.length > 0) {
  console.error(`\n${failing.length} failing route(s).`);
  process.exitCode = 1;
} else {
  console.log('\nAll checks passed.');
}
