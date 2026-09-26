import { describe, expect, it } from "vitest";
import { looksLikeServiceRoleJwt } from "../service-role-guard";

/** Build a syntactically-valid JWT whose payload is `claims`. */
function makeJwt(claims: Record<string, unknown>): string {
  const b64url = (s: string) =>
    Buffer.from(s, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return [
    b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    b64url(JSON.stringify(claims)),
    "sig",
  ].join(".");
}

describe("looksLikeServiceRoleJwt", () => {
  it("flags a JWT whose role claim is service_role", () => {
    expect(looksLikeServiceRoleJwt(makeJwt({ role: "service_role" }))).toBe(
      true,
    );
  });

  it("accepts anon / authenticated roles", () => {
    expect(looksLikeServiceRoleJwt(makeJwt({ role: "anon" }))).toBe(false);
    expect(looksLikeServiceRoleJwt(makeJwt({ role: "authenticated" }))).toBe(
      false,
    );
  });

  it("rejects non-JWT shapes", () => {
    expect(looksLikeServiceRoleJwt("")).toBe(false);
    expect(looksLikeServiceRoleJwt("sb_publishable_key")).toBe(false);
    expect(looksLikeServiceRoleJwt("only.two")).toBe(false);
    expect(looksLikeServiceRoleJwt("a.b.c.d")).toBe(false);
    expect(looksLikeServiceRoleJwt(undefined as never)).toBe(false);
  });

  it("returns false (never throws) on malformed payload base64", () => {
    expect(looksLikeServiceRoleJwt("header.!!!!not-base64!!!!.sig")).toBe(
      false,
    );
  });

  it("returns false when the payload has no role claim", () => {
    expect(looksLikeServiceRoleJwt(makeJwt({ sub: "user-1" }))).toBe(false);
  });
});
