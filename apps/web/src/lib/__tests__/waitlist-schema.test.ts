import { describe, expect, it } from "vitest";
import {
  WaitlistSignupSchema,
  WaitlistSourceSchema,
} from "masarx-shared/types/schemas";

describe("WaitlistSignupSchema", () => {
  it("accepts a valid signup and normalizes the email", () => {
    const result = WaitlistSignupSchema.parse({
      email: "  Student@Example.COM  ",
      source: "trw",
    });
    expect(result.email).toBe("student@example.com");
    expect(result.source).toBe("trw");
  });

  it("accepts every launch source", () => {
    for (const source of ["trw", "macos", "android"] as const) {
      expect(
        WaitlistSignupSchema.safeParse({ email: "a@b.co", source }).success,
      ).toBe(true);
    }
  });

  it("rejects an invalid email", () => {
    expect(
      WaitlistSignupSchema.safeParse({ email: "not-an-email", source: "macos" })
        .success,
    ).toBe(false);
  });

  it("rejects an email without a TLD dot (matches the DB check constraint)", () => {
    expect(
      WaitlistSignupSchema.safeParse({ email: "user@localhost", source: "trw" })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(
      WaitlistSignupSchema.safeParse({ email: "a@b.co", source: "windows" })
        .success,
    ).toBe(false);
  });

  it("rejects an email over 254 characters", () => {
    const long = `${"a".repeat(250)}@x.co`;
    expect(
      WaitlistSignupSchema.safeParse({ email: long, source: "android" })
        .success,
    ).toBe(false);
  });

  it("exposes exactly the three launch sources", () => {
    expect(WaitlistSourceSchema.options).toEqual(["trw", "macos", "android"]);
  });
});
