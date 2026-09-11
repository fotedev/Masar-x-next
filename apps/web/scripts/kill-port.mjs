// Frees the dev-server port (defaults to 3000) before `next dev` starts.
// Usage: node scripts/kill-port.mjs [port]
//        PORT=4000 node scripts/kill-port.mjs
//
// Cross-platform (Windows netstat/taskkill, Unix lsof/kill) using only
// Node builtins — no single-job dependency. Always exits 0 so `predev`
// never blocks `dev`, even when nothing is listening or lookup tools
// (lsof) are missing.

import { execSync } from "node:child_process";

const portArg = Number.parseInt(process.argv[2] ?? process.env.PORT ?? "3000", 10);
const port = Number.isNaN(portArg) ? 3000 : portArg;

function pidsOnPortWindows() {
  const out = execSync(`netstat -ano`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const pids = new Set();
  for (const line of out.split("\n")) {
    // e.g. "  TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234"
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [proto, local, , state, pid] = parts;
    if (!/^TCP/i.test(proto) || state !== "LISTENING") continue;
    if (local.endsWith(`:${port}`) && /^\d+$/.test(pid ?? "")) pids.add(pid);
  }
  return [...pids];
}

function killWindows(pids) {
  for (const pid of pids) {
    if (Number(pid) === process.pid) continue;
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      console.log(`[kill-port] freed port ${port} (PID ${pid})`);
    } catch {
      // Process already gone or not killable — not fatal for dev startup.
    }
  }
}

function pidsOnPortUnix() {
  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split(/\s+/).filter((p) => /^\d+$/.test(p));
  } catch {
    return [];
  }
}

function killUnix(pids) {
  if (pids.length === 0) {
    try {
      execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
      console.log(`[kill-port] freed port ${port} via fuser`);
    } catch {
      // Nothing listening — the common case.
    }
    return;
  }
  for (const pid of pids) {
    if (Number(pid) === process.pid) continue;
    try {
      process.kill(Number(pid), "SIGKILL");
      console.log(`[kill-port] freed port ${port} (PID ${pid})`);
    } catch {
      // Already exited — ignore.
    }
  }
}

try {
  if (process.platform === "win32") {
    const pids = pidsOnPortWindows();
    if (pids.length === 0) console.log(`[kill-port] port ${port} is free — nothing to do`);
    else killWindows(pids);
  } else {
    const pids = pidsOnPortUnix();
    if (pids.length === 0) console.log(`[kill-port] port ${port} is free — nothing to do`);
    else killUnix(pids);
  }
} catch (err) {
  console.warn(`[kill-port] could not check port ${port}: ${err?.message ?? err} — continuing anyway`);
}
process.exit(0);
