import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setMockIntlLocale, nextIntlMockFactory } from "@/test/mocks/next-intl";

const mocks = vi.hoisted(() => ({
  authState: {
    signUp: undefined as unknown as ReturnType<typeof vi.fn>,
    signInWithGoogle: undefined as unknown as ReturnType<typeof vi.fn>,
    user: null as { id: string } | null,
  },
  analyticsState: {
    trackEvent: undefined as unknown as ReturnType<typeof vi.fn>,
    logError: undefined as unknown as ReturnType<typeof vi.fn>,
  },
  routerPush: undefined as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: mocks.analyticsState.trackEvent, logError: mocks.analyticsState.logError }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("@/components/DynamicLogo", () => ({
  DynamicLogo: () => null,
  getLogoPath: () => "/masarx-mark.svg",
}));

vi.mock("next-intl", () => nextIntlMockFactory());

import SignUpPage from "../page";

const EMAIL = "student@example.com";

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  password = "secret123",
  confirm = password,
) {
  await user.type(screen.getByLabelText("authPages.emailLabel"), EMAIL);
  await user.type(screen.getByLabelText("authPages.passwordLabel"), password);
  await user.type(screen.getByLabelText("authPages.confirmPasswordLabel"), confirm);
}

function submitButton() {
  return screen.getByRole("button", { name: "authPages.signUp" });
}

function storedAttempts() {
  const raw = sessionStorage.getItem("signup_attempts");
  return raw ? (JSON.parse(raw) as { count: number; timestamp: number }) : null;
}

beforeEach(() => {
  setMockIntlLocale("en");
  mocks.authState.signUp = vi.fn();
  mocks.authState.signInWithGoogle = vi.fn();
  mocks.authState.user = null;
  mocks.analyticsState.trackEvent = vi.fn();
  mocks.analyticsState.logError = vi.fn();
  mocks.routerPush = vi.fn();
  sessionStorage.clear();
});

describe("SignUpPage", () => {
  it("renders the signup form with all three fields", () => {
    render(<SignUpPage />);
    expect(screen.getByText("authPages.signupTitle")).toBeInTheDocument();
    expect(screen.getByLabelText("authPages.emailLabel")).toHaveAttribute("id", "signup-email");
    expect(screen.getByLabelText("authPages.passwordLabel")).toHaveAttribute(
      "id",
      "signup-password",
    );
    expect(screen.getByLabelText("authPages.confirmPasswordLabel")).toHaveAttribute(
      "id",
      "signup-confirm-password",
    );
  });

  it("password mismatch shows passwordMismatch and never calls signUp", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);
    await fillForm(user, "abcdef123", "different456");
    await user.click(submitButton());

    expect(await screen.findByText("authPages.passwordMismatch")).toBeInTheDocument();
    expect(mocks.authState.signUp).not.toHaveBeenCalled();
    expect(storedAttempts()).toBeNull();
  });

  it("passwords shorter than 6 chars show passwordMinLength (bypasses HTML minLength via programmatic submit)", () => {
    render(<SignUpPage />);
    // fill synchronously via fireEvent: jsdom would block a click-submit on
    // minLength=6, but the handler-level guard must still fire
    fireEvent.change(screen.getByLabelText("authPages.emailLabel"), { target: { value: EMAIL } });
    fireEvent.change(screen.getByLabelText("authPages.passwordLabel"), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("authPages.confirmPasswordLabel"), { target: { value: "abc" } });
    fireEvent.submit(submitButton().closest("form")!);

    expect(screen.getByText("authPages.passwordMinLength")).toBeInTheDocument();
    expect(mocks.authState.signUp).not.toHaveBeenCalled();
  });

  it("successful signUp shows the confirmation, clears the fields and resets attempts", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      "signup_attempts",
      JSON.stringify({ count: 5, timestamp: Date.now() - 10 * 60 * 1000 }),
    );
    mocks.authState.signUp.mockResolvedValueOnce(undefined);
    render(<SignUpPage />);

    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByText("authPages.signupConfirmationSent")).toBeInTheDocument();
    expect(screen.getByLabelText("authPages.emailLabel")).toHaveValue("");
    expect(screen.getByLabelText("authPages.passwordLabel")).toHaveValue("");
    expect(screen.getByLabelText("authPages.confirmPasswordLabel")).toHaveValue("");
    expect(mocks.analyticsState.trackEvent).toHaveBeenCalledWith("signup_success", { method: "email" });
    expect(storedAttempts()).toBeNull();
  });

  it("EMAIL_ALREADY_REGISTERED maps to its localized message and records the attempt", async () => {
    const user = userEvent.setup();
    mocks.authState.signUp.mockRejectedValueOnce(
      Object.assign(new Error("dup"), { code: "EMAIL_ALREADY_REGISTERED" }),
    );
    render(<SignUpPage />);

    await fillForm(user);
    await user.click(submitButton());

    expect(
      await screen.findByText("authPages.signupEmailAlreadyRegistered"),
    ).toBeInTheDocument();
    expect(storedAttempts()?.count).toBe(1);
    expect(mocks.analyticsState.trackEvent).toHaveBeenCalledWith("signup_failure", { method: "email" });
  });

  it("generic failures fall back to signupGenericError", async () => {
    const user = userEvent.setup();
    mocks.authState.signUp.mockRejectedValueOnce(new Error("down"));
    render(<SignUpPage />);

    await fillForm(user);
    await user.click(submitButton());

    expect(await screen.findByText("authPages.signupGenericError")).toBeInTheDocument();
  });

  it("restores the lockout from sessionStorage and blocks submission with the wait message", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      "signup_attempts",
      JSON.stringify({ count: 5, timestamp: Date.now() }),
    );
    render(<SignUpPage />);

    await fillForm(user);
    await user.click(submitButton());

    const wait = await screen.findByText(/lockoutWait/);
    // Deflake: a second can tick between seeding the lockout timestamp and
    // this assertion — assert the remaining window range, not the exact value.
    const seconds = Number(wait.textContent?.match(/"seconds":(\d+)/)?.[1] ?? 0);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(150);
    expect(mocks.authState.signUp).not.toHaveBeenCalled();
  });

  it("locks out with the repeated-failure message after 20 attempts (capped at 5 minutes)", async () => {
    const user = userEvent.setup();
    mocks.authState.signUp.mockRejectedValue(new Error("bad"));
    render(<SignUpPage />);
    await fillForm(user);

    for (let i = 1; i <= 20; i++) {
      await user.click(submitButton());
      await waitFor(() => expect(mocks.authState.signUp).toHaveBeenCalledTimes(i));
    }

    const lockout = await screen.findByText(/lockoutRepeated/);
    // Same deflake as above — a second can tick during the 20-click loop.
    const seconds = Number(lockout.textContent?.match(/"seconds":(\d+)/)?.[1] ?? 0);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(300);
    expect(storedAttempts()?.count).toBe(20);
  });

  it("redirects an already-authenticated visitor home", async () => {
    mocks.authState.user = { id: "u-1" };
    render(<SignUpPage />);
    await waitFor(() => expect(mocks.routerPush).toHaveBeenCalledWith("/en"));
  });
});
