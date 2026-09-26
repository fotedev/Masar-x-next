import { describe, expect, it } from "vitest";
import {
  asErrorMessage,
  formatPuterNeedsLoginMessage,
  isClaudeLikeModel,
  isPuterAuthError,
  isPuterInsufficientFundsError,
  isPuterModelNotAvailableError,
  isPuterTransportError,
} from "../errors";

describe("asErrorMessage", () => {
  it("extracts Error.message", () => {
    expect(asErrorMessage(new Error("boom"))).toBe("boom");
    expect(asErrorMessage(new Error())).toBe("Error");
  });

  it("returns strings verbatim", () => {
    expect(asErrorMessage("plain")).toBe("plain");
  });

  it("joins string fields of object errors", () => {
    expect(asErrorMessage({ message: "m", type: "t" })).toBe("m | t");
  });

  it("digs into nested error/data objects", () => {
    expect(asErrorMessage({ error: { message: "inner" } })).toBe("inner");
    expect(asErrorMessage({ data: { code: "E1" } })).toBe("E1");
  });

  it("falls back to a JSON preview for opaque objects", () => {
    const out = asErrorMessage({ weird: 1 });
    expect(out).toContain('"weird"');
  });

  it("stringifies primitives", () => {
    expect(asErrorMessage(42)).toBe("42");
    expect(asErrorMessage(null)).toBe("null");
  });
});

describe("puter error classifiers", () => {
  it("model-not-available patterns", () => {
    expect(isPuterModelNotAvailableError("Model gpt-x does not exist")).toBe(true);
    expect(isPuterModelNotAvailableError("you do not have access to it")).toBe(true);
    expect(isPuterModelNotAvailableError("ERROR_400_FROM_DELEGATE")).toBe(true);
    expect(isPuterModelNotAvailableError("delegate 404 not found")).toBe(true);
    expect(isPuterModelNotAvailableError("unrelated failure")).toBe(false);
  });

  it("insufficient-funds patterns", () => {
    expect(isPuterInsufficientFundsError("insufficient_funds for model")).toBe(true);
    expect(isPuterInsufficientFundsError("no usage left")).toBe(true);
    expect(isPuterInsufficientFundsError("payment required")).toBe(true);
    expect(isPuterInsufficientFundsError("insufficient balance")).toBe(true);
    expect(isPuterInsufficientFundsError("out of memory")).toBe(false);
  });

  it("auth patterns (broad by design)", () => {
    expect(isPuterAuthError("Not signed in")).toBe(true);
    expect(isPuterAuthError("401 unauthorized")).toBe(true);
    expect(isPuterAuthError("socket hang up")).toBe(false);
  });

  it("transport patterns, excluding model-unavailability", () => {
    expect(isPuterTransportError("websocket is closed before the connection")).toBe(true);
    expect(isPuterTransportError("Failed to fetch")).toBe(true);
    expect(isPuterTransportError("request timed out")).toBe(true);
    // Model errors are NOT transport errors even when transport-shaped words appear.
    expect(isPuterTransportError("Model does not exist")).toBe(false);
  });

  it("claude-like model detection", () => {
    expect(isClaudeLikeModel("claude-3-sonnet")).toBe(true);
    expect(isClaudeLikeModel("gpt-4o-mini")).toBe(true);
    expect(isClaudeLikeModel("o3-mini")).toBe(true);
    expect(isClaudeLikeModel("llama-3")).toBe(false);
    expect(isClaudeLikeModel(undefined)).toBe(false);
  });
});

describe("formatPuterNeedsLoginMessage", () => {
  it("keeps the __PUTER_AUTH_REQUIRED__ sentinel and interpolates the model suffix", () => {
    const withModel = formatPuterNeedsLoginMessage("claude-3", "ar");
    expect(withModel).toContain("__PUTER_AUTH_REQUIRED__");
    expect(withModel).toContain("(claude-3)");

    const withoutModel = formatPuterNeedsLoginMessage(undefined, "en");
    expect(withoutModel).toContain("__PUTER_AUTH_REQUIRED__");
    expect(withoutModel).not.toContain("()");
  });
});
