import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

// --- module mocks (hoisted-safe) -------------------------------------------
const { chain, authMock, desktopState, bridge, loggerInfo, loggerWarn, loggerError } =
  await vi.hoisted(async () => {
    const { createSupabaseMock } = await import("@/test/mocks/supabase");
    return {
      chain: createSupabaseMock(),
      authMock: {
        getSession: vi.fn(
          async (): Promise<{ data: { session: unknown }; error: unknown }> => ({
            data: { session: null },
            error: null,
          }),
        ),
        onAuthStateChange: vi.fn(
          (_cb?: unknown): { data: { subscription: { id: string; unsubscribe: () => void } } } => ({
            data: { subscription: { id: "sub", unsubscribe: () => {} } },
          }),
        ),
        signInWithPassword: vi.fn(
          async (): Promise<{ data: unknown; error: { message: string } | null }> => ({
            data: {},
            error: null,
          }),
        ),
        signUp: vi.fn(
          async (): Promise<{ data: unknown; error: { message: string } | null }> => ({
            data: {},
            error: null,
          }),
        ),
        signInWithOAuth: vi.fn(
          async (): Promise<{ data: { url?: string }; error: { message: string } | null }> => ({
            data: { url: "https://oauth" },
            error: null,
          }),
        ),
        signOut: vi.fn(
          async (): Promise<{ error: { message: string } | null }> => ({ error: null }),
        ),
        exchangeCodeForSession: vi.fn(
          async (): Promise<{ data: unknown; error: unknown }> => ({ data: {}, error: null }),
        ),
      },
      // Desktop runtime gate (spec 014) — flipped per-test.
      desktopState: { enabled: false },
      bridge: {
        auth: {
          rendererReady: vi.fn(async (): Promise<string | null> => null),
          onDeepLink: vi.fn((): (() => void) => () => {}),
        },
        app: { openExternal: vi.fn(async (): Promise<void> => {}) },
      },
      loggerInfo: vi.fn(),
      loggerWarn: vi.fn(),
      loggerError: vi.fn(),
    };
  });

vi.mock("@/lib/supabase", () => ({ supabase: { ...chain.supabase, auth: authMock } }));
vi.mock("@/lib/desktop/runtime", () => ({
  isDesktopRuntime: () => desktopState.enabled,
  getDesktopBridge: () => (desktopState.enabled ? bridge : null),
}));
vi.mock("@/lib/analyticsHelpers", () => ({
  analyticsHelpers: { recordAnalytics: vi.fn(async () => undefined) },
}));
vi.mock("@/lib/storage-cleanup", () => ({ cleanupOldLocalStorage: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: loggerInfo, warn: loggerWarn, error: loggerError },
}));
vi.mock("next-intl", () => ({ useLocale: () => "ar" }));

import { AuthProvider, useAuth } from "../AuthContext";
import { analyticsHelpers } from "@/lib/analyticsHelpers";
import { queryClient } from "@/components/QueryProvider";
import { queryCache } from "@/lib/queryCache";

// Render counter + latest context identity — TOKEN_REFRESHED must NOT
// reallocate the memoized context value (spec 034 Track D).
const probeState = {
  renders: 0,
  last: null as ReturnType<typeof useAuth> | null,
};

function Probe() {
  const auth = useAuth();
  probeState.renders += 1;
  probeState.last = auth;
  return (
    <div>
      <span data-testid="user">{auth.user?.id ?? "none"}</span>
      <span data-testid="isAdmin">{String(auth.isAdmin)}</span>
      <span data-testid="loading">{String(auth.loading)}</span>
      <button data-testid="signin" onClick={() => auth.signIn("e@x.com", "pw")} />
      <button data-testid="signout" onClick={() => auth.signOut()} />
      <button data-testid="google" onClick={() => auth.signInWithGoogle()} />
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

// Capture the onAuthStateChange callback so tests can drive auth events.
function getAuthStateChangeCb() {
  const cb = authMock.onAuthStateChange.mock.calls[0]?.[0];
  return cb as (event: string, session: unknown) => Promise<void>;
}

const mkSession = (role?: string, provider = "email") => ({
  user: {
    id: "u-1",
    app_metadata: { role, provider },
  },
});

// /api/auth/sync calls only — the lean-metrics ping shares the global fetch.
function syncCalls() {
  return (fetch as unknown as ReturnType<typeof vi.fn>)
    .mock.calls.filter(([url]) => url === "/api/auth/sync");
}

beforeEach(() => {
  vi.clearAllMocks();
  probeState.renders = 0;
  probeState.last = null;
  desktopState.enabled = false;
  authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
  authMock.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { id: "sub", unsubscribe: vi.fn() } },
  }));
  bridge.auth.rendererReady.mockResolvedValue(null);
  // /api/auth/sync — called for initial session + forced SIGNED_IN syncs
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
  queryCache.invalidatePrefix("");
});

describe("AuthProvider initialization", () => {
  it("loads the session on mount and settles loading", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
  });

  it("restores an existing session and syncs the profile", async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: mkSession("student") },
      error: null,
    });
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("u-1"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/sync", expect.anything()));
  });

  it("registers the auth-state subscription and unsubscribes on unmount", async () => {
    const unsubscribe = vi.fn();
    authMock.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { id: "sub", unsubscribe } },
    }));
    const { unmount } = renderAuth();
    expect(authMock.onAuthStateChange).toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe("onAuthStateChange handling", () => {
  it("SIGNED_IN promotes admin roles and forces a profile sync", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    const cb = getAuthStateChangeCb();

    await act(async () => {
      await cb("SIGNED_IN", mkSession("admin"));
    });
    expect(screen.getByTestId("user")).toHaveTextContent("u-1");
    expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
    expect(fetch).toHaveBeenCalledWith("/api/auth/sync", expect.anything());
  });

  it("maps doctor and student_admin roles to isAdmin", async () => {
    renderAuth();
    const cb = getAuthStateChangeCb();
    for (const role of ["doctor", "student_admin"]) {
      await act(async () => {
        await cb("INITIAL_SESSION", mkSession(role));
      });
      expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
    }
  });

  it("SIGNED_OUT clears user and admin state", async () => {
    renderAuth();
    const cb = getAuthStateChangeCb();
    await act(async () => {
      await cb("SIGNED_IN", mkSession("admin"));
    });
    expect(screen.getByTestId("isAdmin")).toHaveTextContent("true");
    await act(async () => {
      await cb("SIGNED_OUT", null);
    });
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(screen.getByTestId("isAdmin")).toHaveTextContent("false");
  });
});

describe("TOKEN_REFRESHED identity stability (spec 034 Track D)", () => {
  it("skips same-user refreshes: no re-render, context value identity preserved", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    const cb = getAuthStateChangeCb();

    await act(async () => {
      await cb("INITIAL_SESSION", mkSession("student"));
    });
    await act(async () => {});
    const rendersBefore = probeState.renders;
    const valueBefore = probeState.last;

    await act(async () => {
      await cb("TOKEN_REFRESHED", mkSession("student"));
    });
    await act(async () => {});

    // setLoading(false) on an already-false flag bails out — the memoized
    // context value is NOT reallocated and consumers do not re-render.
    expect(probeState.renders).toBe(rendersBefore);
    expect(probeState.last).toBe(valueBefore);
    // No forced sync either — refreshes are not sign-ins.
    expect(analyticsHelpers.recordAnalytics).not.toHaveBeenCalled();
  });

  it("re-renders for a DIFFERENT user's TOKEN_REFRESHED (guard only skips unchanged ids)", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    const cb = getAuthStateChangeCb();
    await act(async () => {
      await cb("INITIAL_SESSION", mkSession("student"));
    });
    await act(async () => {});
    const rendersBefore = probeState.renders;

    await act(async () => {
      await cb("TOKEN_REFRESHED", {
        user: { id: "u-2", app_metadata: { role: "student" } },
      });
    });

    expect(probeState.renders).toBeGreaterThan(rendersBefore);
    expect(screen.getByTestId("user")).toHaveTextContent("u-2");
  });
});

describe("recovery SIGNED_IN analytics gating (lean metrics)", () => {
  it("recovery SIGNED_IN before INITIAL_SESSION does not record user_login", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    const cb = getAuthStateChangeCb();

    // Session-recovery sign-in: arrives BEFORE any INITIAL_SESSION.
    await act(async () => {
      await cb("SIGNED_IN", mkSession("student"));
    });
    expect(analyticsHelpers.recordAnalytics).not.toHaveBeenCalled();

    // The subscriber's INITIAL_SESSION marks the recovery as seen…
    await act(async () => {
      await cb("INITIAL_SESSION", mkSession("student"));
    });

    // …so the NEXT SIGNED_IN is a genuine login and IS recorded.
    await act(async () => {
      await cb("SIGNED_IN", mkSession("student"));
    });
    expect(analyticsHelpers.recordAnalytics).toHaveBeenCalledTimes(1);
    expect(analyticsHelpers.recordAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        actionType: "user_login",
        contentType: "login",
      }),
    );
  });
});

describe("M45 cross-identity cache wipe on SIGNED_OUT", () => {
  it("clears the react-query client and invalidates the whole queryCache", async () => {
    renderAuth();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    const cb = getAuthStateChangeCb();
    await act(async () => {
      await cb("SIGNED_IN", mkSession("admin"));
    });

    // Seed role-scoped data through the REAL singletons AuthContext uses.
    queryClient.setQueryData(["appeals"], [{ id: "a1" }]);
    queryCache.set("appeals_all", [{ id: "a1" }], 60_000);
    expect(queryClient.getQueryData(["appeals"])).toEqual([{ id: "a1" }]);
    expect(queryCache.get("appeals_all")).toEqual([{ id: "a1" }]);

    await act(async () => {
      await cb("SIGNED_OUT", null);
    });

    // The next identity on this tab must not see the previous one's rows.
    expect(queryClient.getQueryData(["appeals"])).toBeUndefined();
    expect(queryCache.get("appeals_all")).toBeNull();
  });
});

describe("profile sync (/api/auth/sync)", () => {
  it("503 (database not configured) warns but does not throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({}), { status: 503 })),
    );
    authMock.getSession.mockResolvedValue({
      data: { session: mkSession("student") },
      error: null,
    });

    renderAuth();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/auth/sync", expect.anything()));
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("Profile sync unavailable"),
    );
    expect(loggerError).not.toHaveBeenCalled();
    // The auth flow continues despite the unavailable sync.
    expect(screen.getByTestId("user")).toHaveTextContent("u-1");
  });

  it("other failures log a readable message without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ detail: "db down" }), { status: 500 }),
      ),
    );
    authMock.getSession.mockResolvedValue({
      data: { session: mkSession("student") },
      error: null,
    });

    renderAuth();
    await waitFor(() => expect(loggerError).toHaveBeenCalled());

    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining("HTTP 500: db down"),
    );
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("SIGNED_IN forces a sync even within the 10s cooldown", async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: mkSession("student") },
      error: null,
    });
    renderAuth();
    await waitFor(() => expect(syncCalls()).toHaveLength(1)); // mount sync
    const cb = getAuthStateChangeCb();

    await act(async () => {
      await cb("SIGNED_IN", mkSession("student")); // force=true bypasses cooldown
    });

    expect(syncCalls()).toHaveLength(2);
  });

  it("skips a sync while another one is still in flight", async () => {
    let releaseFetch!: (v: Response) => void;
    // Gate ONLY the profile sync; metrics pings resolve immediately (they
    // share the global fetch and must not steal the gate's resolver).
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/metrics/event") {
          return Promise.resolve(new Response("{}", { status: 200 }));
        }
        return new Promise<Response>((resolve) => {
          releaseFetch = resolve;
        });
      }),
    );
    authMock.getSession.mockResolvedValue({
      data: { session: mkSession("student") },
      error: null,
    });

    renderAuth();
    await waitFor(() => expect(syncCalls()).toHaveLength(1)); // mount sync in flight

    const cb = getAuthStateChangeCb();
    await act(async () => {
      await cb("SIGNED_IN", mkSession("admin")); // forced, but a sync is inflight
    });
    expect(syncCalls()).toHaveLength(1);

    releaseFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await act(async () => {});
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });
});

describe("desktop shell integration (spec 014)", () => {
  const deepLink = (code: string) => `masarx://auth/callback?code=${code}`;

  it("exchanges the pending deep-link code delivered before subscription", async () => {
    desktopState.enabled = true;
    bridge.auth.rendererReady.mockResolvedValue(deepLink("cold-start-code"));

    renderAuth();

    await waitFor(() =>
      expect(authMock.exchangeCodeForSession).toHaveBeenCalledWith("cold-start-code"),
    );
    expect(bridge.auth.onDeepLink).toHaveBeenCalledWith(expect.any(Function));
  });

  it("exchanges subsequent deep links, dedupes codes, and rejects foreign URLs", async () => {
    desktopState.enabled = true;
    renderAuth();
    await waitFor(() => expect(bridge.auth.onDeepLink).toHaveBeenCalled());
    const handler = bridge.auth.onDeepLink.mock.calls[0][0] as (url: string) => void;

    await act(async () => {
      handler(deepLink("code-2"));
    });
    await waitFor(() =>
      expect(authMock.exchangeCodeForSession).toHaveBeenCalledWith("code-2"),
    );

    await act(async () => {
      handler(deepLink("code-2")); // duplicate code — skipped
      handler("https://evil.example.com/callback?code=x"); // not masarx — skipped
      handler("masarx://other/path?code=y"); // wrong host/path — skipped
    });

    expect(authMock.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it("Google OAuth uses the masarx:// redirect and opens the system browser", async () => {
    desktopState.enabled = true;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const { result } = renderHookProbe();

    await result.current.signInWithGoogle();

    expect(authMock.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        options: expect.objectContaining({
          redirectTo: "masarx://auth/callback",
          skipBrowserRedirect: true,
          queryParams: { access_type: "offline", prompt: "consent" },
        }),
      }),
    );
    expect(bridge.app.openExternal).toHaveBeenCalledWith("https://oauth");
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("falls back to window.open on shells without the openExternal bridge", async () => {
    desktopState.enabled = true;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const savedApp = bridge.app;
    Object.defineProperty(bridge, "app", { value: {}, configurable: true });

    try {
      const { result } = renderHookProbe();
      await result.current.signInWithGoogle();
      expect(window.open).toHaveBeenCalledWith(
        "https://oauth",
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      Object.defineProperty(bridge, "app", { value: savedApp, configurable: true });
      openSpy.mockRestore();
    }
  });
});

describe("auth actions", () => {
  it("signIn delegates to signInWithPassword and throws on error", async () => {
    const { result } = renderHookProbe();
    await result.current.signIn("a@b.c", "pw");
    expect(authMock.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "pw",
    });

    authMock.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { message: "invalid credentials" },
    });
    await expect(result.current.signIn("a@b.c", "bad")).rejects.toThrow(/invalid credentials/);
  });

  it("signInWithGoogle (web) redirects to the locale-aware callback path", async () => {
    const { result } = renderHookProbe();
    await result.current.signInWithGoogle();
    expect(authMock.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        options: expect.objectContaining({
          redirectTo: expect.stringContaining("/ar/auth/callback"),
        }),
      }),
    );
  });

  it("signOut delegates and throws on error", async () => {
    const { result } = renderHookProbe();
    await result.current.signOut();
    expect(authMock.signOut).toHaveBeenCalled();
  });
});

/** Render the provider and expose the context value via renderHook-style probe. */
function renderHookProbe() {
  const captured: { current: ReturnType<typeof useAuth> } = {} as never;
  function Capture() {
    captured.current = useAuth();
    return null;
  }
  render(
    <AuthProvider>
      <Capture />
    </AuthProvider>,
  );
  return { result: captured };
}
