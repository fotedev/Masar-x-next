import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke config — Spec 010 (MVP report G6.1).
 * Local: `pnpm --filter web test:e2e` (spawns/reuses `pnpm dev` on :3000).
 * CI: server started by the workflow; set E2E_BASE_URL to it.
 * The `--no-proxy-server` arg is deliberate: browser-level localhost reachability
 * on this dev host has failed through proxy paths before (live-verification-env).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--no-proxy-server"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
