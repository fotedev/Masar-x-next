import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  getCurrentSession,
  requireUser,
} from "../index";
import { makeJwt } from "./jwt-helper";

vi.mock("@supabase/ssr", () => ({
  // The web branch constructs a browser client; in node tests we stub it and
  // assert the factory wired the url/key through.
  createBrowserClient: vi.fn(() => ({
    auth: { getSession: vi.fn(), getUser: vi.fn() },
  })),
}));

import { createBrowserClient } from "@supabase/ssr";

const URL = "https://example.supabase.co";
const ANON = makeJwt({ role: "anon" });

describe("createSupabaseClient", () => {
  beforeEach(() => {
    vi.mocked(createBrowserClient).mockClear();
  });

  it("throws when url or anonKey is missing", () => {
    expect(() =>
      createSupabaseClient({ runtime: "web", url: "", anonKey: ANON }),
    ).toThrow(/url.*anonKey|required/i);
    expect(() =>
      createSupabaseClient({ runtime: "web", url: URL, anonKey: "" }),
    ).toThrow(/url.*anonKey|required/i);
    expect(() =>
      createSupabaseClient(undefined as never),
    ).toThrow();
  });

  it("HARD GUARANTEE: refuses a service_role JWT as anonKey", () => {
    expect(() =>
      createSupabaseClient({
        runtime: "web",
        url: URL,
        anonKey: makeJwt({ role: "service_role" }),
      }),
    ).toThrow(/service_role/);
  });

  it("web runtime constructs through @supabase/ssr and tags __clientInfo", () => {
    const client = createSupabaseClient({
      runtime: "web",
      url: URL,
      anonKey: ANON,
      appVersion: "9.9.9",
    });
    expect(createBrowserClient).toHaveBeenCalledWith(URL, ANON);
    expect((client as { __clientInfo?: string }).__clientInfo).toBe(
      "platform=web; app_version=9.9.9",
    );
  });

  it("desktop/mobile runtime without a storage adapter is rejected", () => {
    expect(() =>
      createSupabaseClient({ runtime: "desktop", url: URL, anonKey: ANON }),
    ).toThrow(/storage/);
    expect(() =>
      createSupabaseClient({ runtime: "mobile", url: URL, anonKey: ANON }),
    ).toThrow(/storage/);
  });

  it("desktop runtime with a storage adapter constructs a js client", () => {
    const storage = {
      getItem: vi.fn(async () => null),
      setItem: vi.fn(async () => undefined),
      removeItem: vi.fn(async () => undefined),
    };
    const client = createSupabaseClient({
      runtime: "desktop",
      url: URL,
      anonKey: ANON,
      storage,
    });
    expect((client as { __clientInfo?: string }).__clientInfo).toBe(
      "platform=desktop; app_version=0.0.0",
    );
  });
});

describe("getCurrentSession / requireUser", () => {
  it("getCurrentSession returns the session or null", async () => {
    const session = { access_token: "t" };
    const client = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session }, error: null })),
      },
    } as never;
    expect(await getCurrentSession(client)).toBe(session);

    const empty = {
      auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    } as never;
    expect(await getCurrentSession(empty)).toBeNull();
  });

  it("requireUser returns the user or throws when unauthenticated", async () => {
    const user = { id: "u1" };
    const ok = {
      auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    } as never;
    expect((await requireUser(ok)).id).toBe("u1");

    const anon = {
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
    } as never;
    await expect(requireUser(anon)).rejects.toThrow(/requireUser/);
  });
});
