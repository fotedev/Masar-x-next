import { beforeEach, describe, expect, it, vi , type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setMockIntlLocale, nextIntlMockFactory } from "@/test/mocks/next-intl";

const mocks = vi.hoisted(() => ({
  mutate: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
  isPending: false,
  toastSuccess: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
  toastError: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
  routerPush: undefined as unknown as Mock<(...args: unknown[]) => unknown>,
}));

vi.mock("@/hooks/trw/useRedeemAccessCode", () => ({
  default: () => ({ mutate: mocks.mutate, isPending: mocks.isPending }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock("next-intl", () => nextIntlMockFactory());

import RedeemPage from "../page";

type RedeemOptions = {
  onSuccess: (data: { success: boolean; plan_slug?: string; error?: string }) => void;
  onError: (error: unknown) => void;
};

function lastOptions(): RedeemOptions {
  const calls = mocks.mutate.mock.calls;
  return calls[calls.length - 1][1] as RedeemOptions;
}

beforeEach(() => {
  setMockIntlLocale("en");
  mocks.mutate = vi.fn();
  mocks.isPending = false;
  mocks.toastSuccess = vi.fn();
  mocks.toastError = vi.fn();
  mocks.routerPush = vi.fn();
});

describe("TRW redeem page", () => {
  it("renders the card and keeps the submit disabled for an empty code", () => {
    render(<RedeemPage />);
    expect(screen.getByText("trwRedeem.title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("trwRedeem.placeholder")).toHaveValue("");
    expect(screen.getByRole("button", { name: "trwRedeem.submit" })).toBeDisabled();
  });

  it("uppercases the code as typed and calls the mutation with it", async () => {
    const user = userEvent.setup();
    render(<RedeemPage />);

    const input = screen.getByPlaceholderText("trwRedeem.placeholder");
    await user.type(input, "abc123xyz");
    expect(input).toHaveValue("ABC123XYZ");

    await user.click(screen.getByRole("button", { name: "trwRedeem.submit" }));
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    const [code, opts] = mocks.mutate.mock.calls[0];
    expect(code).toBe("ABC123XYZ");
    expect(typeof (opts as RedeemOptions).onSuccess).toBe("function");
    expect(typeof (opts as RedeemOptions).onError).toBe("function");
  });

  it("success toasts and pushes to the localized non-academic hub", async () => {
    const user = userEvent.setup();
    render(<RedeemPage />);
    await user.type(screen.getByPlaceholderText("trwRedeem.placeholder"), "code");
    await user.click(screen.getByRole("button", { name: "trwRedeem.submit" }));

    lastOptions().onSuccess({ success: true, plan_slug: "monthly" });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('trwRedeem.success {"plan":"monthly"}');
    expect(mocks.routerPush).toHaveBeenCalledWith("/en/non-academic");
  });

  it("maps each error slug to its localized message", async () => {
    const user = userEvent.setup();
    render(<RedeemPage />);
    await user.type(screen.getByPlaceholderText("trwRedeem.placeholder"), "code");
    await user.click(screen.getByRole("button", { name: "trwRedeem.submit" }));

    const opts = lastOptions();
    opts.onSuccess({ success: false, error: "invalid_or_expired_code" });
    expect(mocks.toastError).toHaveBeenLastCalledWith("trwRedeem.invalidOrExpired");

    opts.onSuccess({ success: false, error: "already_redeemed" });
    expect(mocks.toastError).toHaveBeenLastCalledWith("trwRedeem.alreadyRedeemed");

    opts.onSuccess({ success: false, error: "not_authenticated" });
    expect(mocks.toastError).toHaveBeenLastCalledWith("trwRedeem.notAuthenticated");

    opts.onSuccess({ success: false, error: "something_new" });
    expect(mocks.toastError).toHaveBeenLastCalledWith("trwRedeem.failed");
  });

  it("onError surfaces the error message, falling back to connection-error", async () => {
    const user = userEvent.setup();
    render(<RedeemPage />);
    await user.type(screen.getByPlaceholderText("trwRedeem.placeholder"), "code");
    await user.click(screen.getByRole("button", { name: "trwRedeem.submit" }));

    const opts = lastOptions();
    opts.onError(new Error("boom"));
    expect(mocks.toastError).toHaveBeenLastCalledWith("boom");

    opts.onError("not an object with message");
    expect(mocks.toastError).toHaveBeenLastCalledWith("trwRedeem.connectionError");
  });

  it("pending state disables input + button and shows the submitting label", () => {
    mocks.isPending = true;
    render(<RedeemPage />);
    expect(screen.getByRole("button", { name: "trwRedeem.submitting" })).toBeDisabled();
    expect(screen.getByPlaceholderText("trwRedeem.placeholder")).toBeDisabled();
  });

  it("does not call the mutation while pending", async () => {
    const user = userEvent.setup();
    mocks.isPending = true;
    render(<RedeemPage />);
    await user.click(screen.getByRole("button", { name: "trwRedeem.submitting" }));
    await waitFor(() => expect(mocks.mutate).not.toHaveBeenCalled());
  });
});
