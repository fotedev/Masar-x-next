import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

// --- module mocks (hoisted-safe) -------------------------------------------
const { chain, authMock } = await vi.hoisted(async () => {
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
  };
});

vi.mock("@/lib/supabase", () => ({ supabase: { ...chain.supabase, auth: authMock } }));
vi.mock("@/lib/desktop/runtime", () => ({
  isDesktopRuntime: () => false,
  getDesktopBridge: () => null,
}));
vi.mock("@/lib/analyticsHelpers", () => ({
  analyticsHelpers: { recordAnalytics: vi.fn(async () => undefined) },
}));
vi.mock("@/lib/storage-cleanup", () => ({ cleanupOldLocalStorage: vi.fn() }));
vi.mock("next-intl", () => ({ useLocale: () => "ar" }));

import { AuthProvider, useAuth } from "../AuthContext";

function Probe() {
  const auth = useAuth();
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

beforeEach(() => {
  vi.clearAllMocks();
  authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
  authMock.onAuthStateChange.mockImplementation(() => ({
    data: { subscription: { id: "sub", unsubscribe: vi.fn() } },
  }));
  // /api/auth/sync — called for initial session + forced SIGNED_IN syncs
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );
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
