/**
 * Signup/forgot-password validation tests (spec 019 C3/T086).
 */
import { describe, expect, it } from "vitest";

import {
  mapSignupError,
  validateResetEmail,
  validateSignup,
} from "../signup-validation";

describe("validateSignup", () => {
  it("accepts a well-formed payload", () => {
    expect(validateSignup("s@x.com", "secret1", "secret1")).toBeNull();
  });

  it("rejects short passwords with passwordMinLength", () => {
    expect(validateSignup("s@x.com", "abc", "abc")).toBe("passwordMinLength");
  });

  it("rejects mismatched confirmations with passwordMismatch", () => {
    expect(validateSignup("s@x.com", "secret1", "secret2")).toBe(
      "passwordMismatch",
    );
  });

  it("rejects an empty email with the generic key", () => {
    expect(validateSignup("   ", "secret1", "secret1")).toBe(
      "signupGenericError",
    );
  });
});

describe("mapSignupError", () => {
  it("maps Supabase's duplicate-email message", () => {
    expect(mapSignupError("User already registered")).toBe(
      "signupEmailAlreadyRegistered",
    );
    expect(mapSignupError("email already exists")).toBe(
      "signupEmailAlreadyRegistered",
    );
  });

  it("collapses every other failure to the generic key", () => {
    expect(mapSignupError("Password should be at least 6 characters")).toBe(
      "signupGenericError",
    );
    expect(mapSignupError("")).toBe("signupGenericError");
  });
});

describe("validateResetEmail", () => {
  it("requires a non-blank email", () => {
    expect(validateResetEmail("")).toBe("emailRequiredForReset");
    expect(validateResetEmail("  ")).toBe("emailRequiredForReset");
    expect(validateResetEmail("s@x.com")).toBeNull();
  });
});
