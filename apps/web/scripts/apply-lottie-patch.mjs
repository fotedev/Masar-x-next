#!/usr/bin/env node
/**
 * Postinstall hook: apply the dotlottie-react race-condition fix to the
 * file in node_modules. pnpm 11 pulled a slightly newer revision of
 * 0.18.x whose git blob hash doesn't match the original pnpm patch,
 * so the patch can no longer be auto-applied. Instead we apply the
 * fix directly via a Node script (runs under any platform, no Python
 * dependency).
 *
 * The fix matches the original pnpm patch the user said was working:
 *   - Remove `animationId` from the constructor's `A` config (so the
 *     worker doesn't try to load the animation before the .lottie file
 *     is parsed). Wrap it in a conditional spread so the property only
 *     appears when truthy.
 *   - Replace the bare `stateMachineLoad` useEffect with a `load` event
 *     listener that defers state machine + animation loading to when
 *     the file is actually ready (and re-fires if already loaded).
 *
 * Idempotent: exits silently if the file is already patched.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Find every `index.js` under `node_modules/@lottiefiles/dotlottie-react`
 * and any matching `.pnpm/@lottiefiles+dotlottie-react@*` package store
 * location. pnpm keeps both a top-level copy and a hash-named copy in
 * `.pnpm/`, and depending on the workspace layout one or the other is
 * the canonical import target. Patching only the top-level one is what
 * the user hit before — the dev server then loaded the un-patched
 * `.pnpm` copy after a HMR.
 */
function findTargets() {
  const targets = [];
  const top = "node_modules/@lottiefiles/dotlottie-react/dist/index.js";
  if (existsSync(top)) targets.push(top);

  const pnpmRoot = "node_modules/.pnpm";
  if (existsSync(pnpmRoot)) {
    for (const entry of readdirSync(pnpmRoot)) {
      if (!entry.startsWith("@lottiefiles+dotlottie-react@")) continue;
      if (entry.endsWith(".bak")) continue; // skip rotated backups
      const candidate = join(
        pnpmRoot,
        entry,
        "node_modules/@lottiefiles/dotlottie-react/dist/index.js",
      );
      if (existsSync(candidate)) targets.push(candidate);
    }
  }
  return targets;
}

const TARGETS = findTargets();
if (TARGETS.length === 0) {
  console.log("[apply-lottie-patch] no targets found, skipping");
  process.exit(0);
}

function applyTransforms(content) {
  // Idempotency: if the L function is already present (with the two-`if`
  // shape and `.catch(()=>{})` swallowers) we treat the file as already
  // fully patched.
  if (content.includes("p.loadAnimation(e)?.catch(()=>{})")) {
    return { content, changed: false };
  }

  // --- Transform #1: remove `animationId:e,` from `A` (the constructor
  // config) entirely. The worker constructor auto-loads whatever animation
  // id is in the config — but the .lottie file isn't parsed yet at that
  // point, so it logs `Failed to load animation with id: Main Scene` and
  // the animation never starts. The state-machine listener (transform #3
  // below) starts the state machine (and thus the default animation) only
  // after the worker actually fires its `load` event.
  const aReplacements = [
    // 0.18.10 pattern: `animationId` between `renderConfig` and `stateMachineConfig`
    [
      "renderConfig:h,animationId:e,stateMachineConfig:y,stateMachineId:b",
      "renderConfig:h,stateMachineConfig:y,stateMachineId:b",
    ],
    // 0.18.9 / older pattern: `animationId` is right before `stateMachineConfig`
    [
      "animationId:e,stateMachineConfig:y,stateMachineId:b",
      "stateMachineConfig:y,stateMachineId:b",
    ],
  ];
  let aReplaced = false;
  for (const [old, fresh] of aReplacements) {
    if (content.includes(old)) {
      content = content.replace(old, fresh, 1);
      aReplaced = true;
      break;
    }
  }
  if (!aReplaced) {
    return { content, changed: false, skipped: "A object pattern not found" };
  }

  // --- Transform #2: gate `loadAnimation` on `isLoaded` and swallow
  // the worker's async rejection (`loadAnimation` returns a Promise
  // that rejects with `Failed to load animation with id: Main Scene`
  // when the .lottie manifest isn't yet ready; that rejection is not
  // caught by a plain `try/catch`).
  const loadAnimationPatterns = [
    "r(()=>{D.current?.loadAnimation(e??``)},[e])",
    "r(()=>{D.current?.loadAnimation(e)},[e])",
  ];
  const newLoadAnimationEffect =
    "r(()=>{if(e&&D.current?.isLoaded){D.current?.loadAnimation(e)?.catch(()=>{})}},[e])";
  for (const old of loadAnimationPatterns) {
    if (content.includes(old)) {
      content = content.replace(old, newLoadAnimationEffect, 1);
      break;
    }
  }

  // --- Transform #3: replace the bare `stateMachineLoad` useEffect with
  // a `load` event listener so the state machine (and the default
  // animation it transitions to) only starts after the worker has fired
  // its `load` event. Same `.catch(()=>{})` swallowers for the async
  // worker rejections (`stateMachineStart` can also reject with the same
  // `Failed to load animation` error during a mount/unmount race).
  const stateMachinePatterns = [
    "r(()=>{D.current?.isLoaded&&(typeof b==`string`&&b?D.current.stateMachineLoad(b)&&D.current.stateMachineStart():D.current.stateMachineStop())},[b])",
    "r(()=>{typeof b==`string`&&b?D.current.stateMachineLoad(b)&&D.current.stateMachineStart():D.current.stateMachineStop()},[b])",
  ];
  const newStateMachineEffect =
    "r(()=>{let p=D.current;if(!p)return;let L=()=>{try{" +
    "if(b&&typeof b===`string`){p.stateMachineLoad(b)?.catch(()=>{});p.stateMachineStart()?.catch(()=>{})}" +
    "if(e&&typeof e===`string`){p.loadAnimation(e)?.catch(()=>{})}" +
    "}catch{}};" +
    "return p.addEventListener(`load`,L),p.isLoaded&&L()," +
    "()=>{p.removeEventListener(`load`,L)}},[v,e,b])";
  for (const old of stateMachinePatterns) {
    if (content.includes(old)) {
      content = content.replace(old, newStateMachineEffect, 1);
      break;
    }
  }

  return { content, changed: true };
}

for (const target of TARGETS) {
  const content = readFileSync(target, "utf8");
  const result = applyTransforms(content);
  if (result.skipped) {
    console.warn(`[apply-lottie-patch] skip ${target}: ${result.skipped}`);
    continue;
  }
  if (!result.changed) {
    console.log(`[apply-lottie-patch] ${target} already patched`);
    continue;
  }
  writeFileSync(target, result.content, "utf8");
  console.log(`[apply-lottie-patch] wrote ${target} (${result.content.length} bytes)`);
}
