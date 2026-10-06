/**
 * Unit tests for ../auth.ts (P0 hotfix support).
 * Zero dependencies: plain Deno.test + local assert (runs offline).
 */
import { getBearerToken } from "../auth.ts";

function assertEquals(actual: unknown, expected: unknown, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function reqWith(auth: string | null): Request {
  const headers = new Headers();
  if (auth !== null) headers.set("authorization", auth);
  return new Request("https://functions.local/delete-avatar", { headers });
}

Deno.test("getBearerToken: extracts token from Bearer header", () => {
  assertEquals(getBearerToken(reqWith("Bearer abc.def.ghi")), "abc.def.ghi", "bearer");
});

Deno.test("getBearerToken: missing / malformed headers -> null (must 401)", () => {
  assertEquals(getBearerToken(reqWith(null)), null, "missing header");
  assertEquals(getBearerToken(reqWith("")), null, "empty header");
  assertEquals(getBearerToken(reqWith("Bearer ")), null, "empty token");
  assertEquals(getBearerToken(reqWith("Basic abc")), null, "wrong scheme");
  assertEquals(getBearerToken(reqWith("Bearer")), null, "no token part");
});
