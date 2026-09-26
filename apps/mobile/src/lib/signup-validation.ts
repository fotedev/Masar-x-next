/**
 * Signup + forgot-password validation (spec 019 C3/T086) — pure logic
 * mirroring the web forms' client-side rules (apps/web login/signup
 * pages): minimum password length, confirm-password match, and error
 * mapping for the standard Supabase registration failures. Keys refer
 * to the shared `authPages` namespace; screens resolve them via
 * t(locale, "authPages", key).
 */

export type SignupErrorKey =
  | "passwordMinLength"
  | "passwordMismatch"
  | "signupGenericError";

export const PASSWORD_MIN_LENGTH = 6;

/**
 * Client-side signup gate (same rules as the web signup form): both
 * fields present, password at least 6 chars, confirmation matches.
 * Returns null when the payload may proceed to supabase.auth.signUp.
 */
export function validateSignup(
  email: string,
  password: string,
  confirmPassword: string,
): SignupErrorKey | null {
  if (!email.trim() || !password) return "signupGenericError";
  if (password.length < PASSWORD_MIN_LENGTH) return "passwordMinLength";
  if (password !== confirmPassword) return "passwordMismatch";
  return null;
}

/**
 * Map a Supabase signUp error message to an authPages key. Web parity:
 * "User already registered" is the canonical duplicate-email failure;
 * everything else collapses to the generic error (the raw message is
 * never shown for signup — it leaks provider internals).
 */
export function mapSignupError(
  message: string,
): "signupEmailAlreadyRegistered" | "signupGenericError" {
  return /already\s+registered|already\s+exists/i.test(message)
    ? "signupEmailAlreadyRegistered"
    : "signupGenericError";
}

/** Reset form gate: an email address is required before sending. */
export function validateResetEmail(
  email: string,
): "emailRequiredForReset" | null {
  return email.trim() ? null : "emailRequiredForReset";
}
