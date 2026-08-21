// ============================================================================
// dereference-standalone.cjs
// Spec: specs/004-multi-platform-expansion §T020.2, §T025
//
// Why this exists
// ---------------
// Next.js's `output: 'standalone'` keeps the pnpm-style `node_modules/.pnpm`
// virtual-store layout under `.next/standalone/node_modules`. Real files
// live in `.pnpm/<pkg>@<ver>/node_modules/<pkg>/`; pnpm normally exposes
// them via relative symlinks like `.pnpm/node_modules/semver ->
// ../semver@7.7.4/node_modules/semver`. Next copies the real files into
// the store but ships the convenience symlinks unchanged.
//
// electron-builder's NSIS step chokes on these symlinks for two reasons:
//   1. Some pnpm convenience symlinks are broken (target path missing) —
//      NSIS's file copy refuses to follow them.
//   2. Even valid symlinks are not preserved by makensis's file copy,
//      so the resulting installer would contain dangling shortcuts.
//
// Fix: walk `.next/standalone` and replace every symlink with a real
// copy of its target (or delete it if broken). Idempotent — safe to run
// repeatedly. Safe to run on a freshly-built tree; the result is the
// same regardless of how many times it's invoked.
//
// This script is wired as the `postbuild` of `apps/web/package.json` so
// it runs automatically after `next build` finishes. It can also be run
// directly: `node scripts/dereference-standalone.cjs`.
// ============================================================================

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '.next', 'standalone');

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    // Use statSync (follows symlinks) instead of lstatSync so a
    // symlink-to-dir like `@swc/helpers -> ../../@swc+helpers@0.5.15/...`
    // gets copied as a real tree, not silently skipped. This matters
    // for the pnpm virtual-store layout where dirs often wrap
    // symlinks to the actual store entries.
    let stat;
    try {
      stat = fs.statSync(s);
    } catch {
      // dangling symlink — nothing to copy
      continue;
    }
    if (stat.isDirectory()) {
      copyDirSync(s, d);
    } else if (stat.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

/**
 * Recursively dereference every symlink under `dir`. A valid symlink
 * is replaced with a real copy of its target. A broken symlink is
 * simply unlinked (the dangling shortcut has no value once the
 * standalone tree is shipped).
 */
function dereference(dir) {
  if (!fs.existsSync(dir)) return { replaced: 0, broken: 0 };

  let replaced = 0;
  let broken = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      // On Windows, fs.realpathSync can throw EPERM for some pnpm
      // symlinks even when the target exists (it walks the chain
      // through directories the process has already touched). Use
      // readlinkSync + path.resolve instead, which doesn't follow
      // the chain and therefore doesn't trip that cache.
      let linkTarget;
      try {
        linkTarget = fs.readlinkSync(full);
      } catch {
        const rel = path.relative(ROOT, full);
        console.warn(`[dereference-standalone] removing unreadable symlink: ${rel}`);
        try { fs.unlinkSync(full); } catch { /* already gone */ }
        broken++;
        continue;
      }

      // Resolve relative to the symlink's parent.
      const parent = path.dirname(full);
      const resolved = path.resolve(parent, linkTarget);

      if (!fs.existsSync(resolved)) {
        // Genuinely broken (target path doesn't exist on disk).
        const rel = path.relative(ROOT, full);
        console.warn(`[dereference-standalone] removing broken symlink: ${rel}`);
        try { fs.unlinkSync(full); } catch { /* already gone */ }
        broken++;
        continue;
      }

      const stat = fs.statSync(resolved); // follow the link for type
      try { fs.unlinkSync(full); } catch { /* race with another walker */ }
      if (stat.isDirectory()) {
        copyDirSync(resolved, full);

        // Pnpm virtual-store pattern: when the dereferenced symlink
        // came from a pnpm virtual-store entry like
        //   .pnpm/<key>/node_modules/<pkg>
        // the *siblings* of <pkg> in that same `node_modules/` dir
        // are pnpm's own convenience symlinks to the package's
        // transitive deps. Node's module resolution walks up from
        // <pkg>/dist/... to <pkg>/node_modules/ where those siblings
        // live. Once we replace <pkg> with a real dir (not a symlink),
        // that walk-up no longer reaches the pnpm store, so we have
        // to recreate the siblings under <full>/node_modules/.
        const virtualStoreRe =
          /[\\\/]\.pnpm[\\\/][^\\\/]+[\\\/]node_modules[\\\/][^\\\/]+$/;
        if (virtualStoreRe.test(resolved)) {
          const targetParent = path.dirname(resolved); // e.g. .pnpm/<key>/node_modules/
          const targetBase = path.basename(resolved);
          let siblings;
          try {
            siblings = fs.readdirSync(targetParent, { withFileTypes: true });
          } catch {
            siblings = [];
          }
          const realSiblings = siblings.filter((e) => e.name !== targetBase);
          if (realSiblings.length > 0) {
            const newNm = path.join(full, 'node_modules');
            fs.mkdirSync(newNm, { recursive: true });
            for (const sib of realSiblings) {
              const sibSrc = path.join(targetParent, sib.name);
              const sibDst = path.join(newNm, sib.name);
              if (sib.isSymbolicLink()) {
                // Resolve the sibling symlink manually (same Windows
                // EPERM workaround as above).
                let sibLink;
                try {
                  sibLink = fs.readlinkSync(sibSrc);
                } catch {
                  continue;
                }
                const sibResolved = path.resolve(
                  path.dirname(sibSrc),
                  sibLink,
                );
                if (fs.existsSync(sibResolved)) {
                  const sibStat = fs.statSync(sibResolved);
                  if (sibStat.isDirectory()) {
                    copyDirSync(sibResolved, sibDst);
                  } else {
                    fs.copyFileSync(sibResolved, sibDst);
                  }
                }
              } else if (sib.isDirectory()) {
                copyDirSync(sibSrc, sibDst);
              } else if (sib.isFile()) {
                fs.copyFileSync(sibSrc, sibDst);
              }
            }
          }
        }
      } else {
        fs.copyFileSync(resolved, full);
      }
      replaced++;
    } else if (entry.isDirectory()) {
      const sub = dereference(full);
      replaced += sub.replaced;
      broken += sub.broken;
    }
  }

  return { replaced, broken };
}

if (!fs.existsSync(ROOT)) {
  console.error(
    `[dereference-standalone] ${ROOT} does not exist. ` +
      'Run `pnpm --filter web build` first to produce the standalone output.',
  );
  process.exit(1);
}

console.log(`[dereference-standalone] walking ${ROOT}`);
const { replaced, broken } = dereference(ROOT);
console.log(
  `[dereference-standalone] done — replaced ${replaced} symlink(s), ` +
    `removed ${broken} broken`,
);
