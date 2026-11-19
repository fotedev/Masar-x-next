import { afterEach, describe, expect, it, vi } from "vitest";

// SITE_URL is evaluated once at module import, so each case stubs the env
// FIRST and re-imports the module with a cleared registry (CodeRabbit
// spec-052 thread: trailing slashes must never reach sitemap/robots URLs).
async function importSiteUrl(): Promise<typeof import("../site-url")> {
  return import("../site-url");
}

describe("SITE_URL — spec 052", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("falls back to the core domain when NEXT_PUBLIC_SITE_URL is unset/empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const { SITE_URL } = await importSiteUrl();
    expect(SITE_URL).toBe("https://masarx.vercel.app");
  });

  it("strips trailing slashes from owner-configured values", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://faculty.example/");
    const { SITE_URL } = await importSiteUrl();
    expect(SITE_URL).toBe("https://faculty.example");
  });

  it("strips multiple trailing slashes, not just one", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://faculty.example///");
    const { SITE_URL } = await importSiteUrl();
    expect(SITE_URL).toBe("https://faculty.example");
  });

  it("keeps values that already have no trailing slash", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://faculty.example");
    const { SITE_URL } = await importSiteUrl();
    expect(SITE_URL).toBe("https://faculty.example");
  });
});
