import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setMockIntlLocale, nextIntlMockFactory } from "@/test/mocks/next-intl";

const mocks = vi.hoisted(() => ({
  authState: {
    signIn: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
    signInWithGoogle: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
    user: null as { id: string } | null,
  },
  analyticsState: {
    trackEvent: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
    logError: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
  },
  resetPasswordForEmail: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
  routerPush: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: mocks.analyticsState.trackEvent, logError: mocks.analyticsState.logError }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      // call-time indirection: the factory runs before beforeEach assigns
      // the spy, so a direct reference would be frozen as undefined
      resetPasswordForEmail: (...args: unknown[]) => mocks.resetPasswordForEmail(...args),
    },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("@/components/DynamicLogo", () => ({
  DynamicLogo: () => null,
  getLogoPath: () => "/masarx-mark.svg",
}));

vi.mock("next-intl", () => nextIntlMockFactory());

import LoginPage from "../page";

const EMAIL = "student@example.com";
const PASSWORD = "secret123";
const EMAIL_FIELD = "authPages.emailLabel";

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(EMAIL_FIELD), EMAIL);
  await user.type(screen.getByLabelText("authPages.passwordLabel"), PASSWORD);
}

function submitButton() {
  return screen.getByRole("button", { name: "authPages.signIn" });
}

function storedAttempts() {
  const raw = sessionStorage.getItem("login_attempts");
  return raw ? (JSON.parse(raw) as { count: number; timestamp: number }) : null;
}

beforeEach(() => {
  setMockIntlLocale("en");
  mocks.authState.signIn = vi.fn();
  mocks.authState.signInWithGoogle = vi.fn();
  mocks.authState.user = null;
  mocks.analyticsState.trackEvent = vi.fn();
  mocks.analyticsState.logError = vi.fn();
  mocks.resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
  mocks.routerPush = vi.fn();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, "", "/en/login");
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("LoginPage", () => {
  it("renders the login form with email/password fields", () => {
    render(<LoginPage />);
    expect(screen.getByText("authPages.welcomeBackTitle")).toBeInTheDocument();
    expect(screen.getByLabelText(EMAIL_FIELD)).toHaveAttribute("id", "login-email");
    expect(screen.getByLabelText("authPages.passwordLabel")).toHaveAttribute(
      "id",
      "login-password",
    );
  });

  it("failed signIn with INVALID_CREDENTIALS shows the localized error and records the attempt", async () => {
    const user = userEvent.setup();
    mocks.authState.signIn.mockRejectedValueOnce(
      Object.assign(new Error("invalid"), { code: "INVALID_CREDENTIALS" }),
    );
    render(<LoginPage />);

    await fillCredentials(user);
    await user.click(submitButton());

    expect(await screen.findByText("authPages.invalidCredentials")).toBeInTheDocument();
    expect(storedAttempts()?.count).toBe(1);
    expect(mocks.analyticsState.trackEvent).toHaveBeenCalledWith("login_failure", { method: "email" });
    expect(mocks.analyticsState.logError).toHaveBeenCalled();
  });

  it("non-credential failures fall back to the generic error", async () => {
    const user = userEvent.setup();
    mocks.authState.signIn.mockRejectedValueOnce(new Error("network down"));
    render(<LoginPage />);

    await fillCredentials(user);
    await user.click(submitButton());

    expect(await screen.findByText("authPages.loginGenericError")).toBeInTheDocument();
  });

  it("successful signIn tracks login_success and clears the error state", async () => {
    const user = userEvent.setup();
    mocks.authState.signIn.mockResolvedValueOnce(undefined);
    render(<LoginPage />);

    await fillCredentials(user);
    await user.click(submitButton());

    await waitFor(() =>
      expect(mocks.analyticsState.trackEvent).toHaveBeenCalledWith("login_success", { method: "email" }),
    );
    expect(screen.queryByText(/loginGenericError|invalidCredentials/)).toBeNull();
    // counter stays untouched on success
    expect(storedAttempts()).toBeNull();
  });

  it("restores the lockout from sessionStorage and blocks submission with the wait message", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      "login_attempts",
      JSON.stringify({ count: 5, timestamp: Date.now() }),
    );
    render(<LoginPage />);

    await fillCredentials(user);
    await user.click(submitButton());

    // min(5 * 30s, 5min) = 150s remaining
    const wait = await screen.findByText(/lockoutWait/);
    expect(wait.textContent).toContain('"seconds":150');
    expect(mocks.authState.signIn).not.toHaveBeenCalled();
  });

  it("expired lockout entries are dropped instead of restored", () => {
    sessionStorage.setItem(
      "login_attempts",
      JSON.stringify({ count: 5, timestamp: Date.now() - 10 * 60 * 1000 }),
    );
    render(<LoginPage />);
    expect(sessionStorage.getItem("login_attempts")).toBeNull();
    expect(screen.getByRole("button", { name: "authPages.signIn" })).toBeEnabled();
  });

  it("locks out with the repeated-failure message after 20 attempts (capped at 5 minutes)", async () => {
    const user = userEvent.setup();
    mocks.authState.signIn.mockRejectedValue(new Error("bad"));
    render(<LoginPage />);
    // jsdom enforces the required fields — fill once, then hammer submit
    await fillCredentials(user);

    for (let i = 1; i <= 20; i++) {
      await user.click(submitButton());
      await waitFor(() => expect(mocks.authState.signIn).toHaveBeenCalledTimes(i));
    }

    const lockout = await screen.findByText(/lockoutRepeated/);
    // min(20 * 30s, 300s) = 300s
    expect(lockout.textContent).toContain('"seconds":300');
    expect(storedAttempts()?.count).toBe(20);
  });

  it("surfaces the OAuth failure banner for ?error=auth-code-error", () => {
    window.history.replaceState(null, "", "/en/login?error=auth-code-error");
    render(<LoginPage />);
    expect(screen.getByText("authPages.loginGenericError")).toBeInTheDocument();
  });

  it("forgot password requires a non-empty email, then calls resetPasswordForEmail with redirectTo", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "authPages.forgotPassword" }));
    expect(screen.getByText("authPages.forgotPasswordTitle")).toBeInTheDocument();

    const send = screen.getByRole("button", { name: "authPages.sendResetLink" });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(EMAIL_FIELD), EMAIL);
    await user.click(send);

    await waitFor(() => expect(mocks.resetPasswordForEmail).toHaveBeenCalledTimes(1));
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(EMAIL, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    expect(await screen.findByText("authPages.resetLinkSent")).toBeInTheDocument();
  });

  it("back to login returns from the forgot-password view", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "authPages.forgotPassword" }));
    await user.click(screen.getByRole("button", { name: "authPages.backToLogin" }));
    expect(screen.getByText("authPages.welcomeBackTitle")).toBeInTheDocument();
  });

  it("redirects an already-authenticated visitor home", async () => {
    mocks.authState.user = { id: "u-1" };
    render(<LoginPage />);
    await waitFor(() => expect(mocks.routerPush).toHaveBeenCalledWith("/en"));
  });
});
