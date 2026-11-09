/**
 * Unit tests for ../crypto.ts (spec 040 Wave 6).
 * Zero dependencies: plain Deno.test + local assert (runs offline — WebCrypto
 * is built into the Deno runtime).
 *
 * Pins known digest vectors (NIST/RFC 3174 classics), hex encoding shape,
 * determinism, and unicode input handling.
 */
import { sha1Hex, sha256Hex } from "../crypto.ts";

function assertEquals(actual: unknown, expected: unknown, msg: string): void {
  if (actual !== expected) {
    throw new Error(
      `${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertHex(value: string, length: number, msg: string): void {
  assertEquals(value.length, length, `${msg}: hex length`);
  assertEquals(/^[0-9a-f]+$/.test(value), true, `${msg}: lowercase hex charset only`);
}

// ---------------------------------------------------------------------------
// SHA-256
// ---------------------------------------------------------------------------

Deno.test("sha256Hex: empty string known vector", async () => {
  assertEquals(
    await sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "sha256('')",
  );
});

Deno.test("sha256Hex: 'abc' known vector", async () => {
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "sha256('abc')",
  );
});

Deno.test("sha256Hex: output shape and determinism", async () => {
  const first = await sha256Hex("some-token-12345");
  assertHex(first, 64, "sha256 output");
  assertEquals(await sha256Hex("some-token-12345"), first, "deterministic");
});

Deno.test("sha256Hex: different inputs -> different digests", async () => {
  const a = await sha256Hex("user@example.com");
  const b = await sha256Hex("user+example.com");
  assertEquals(a === b, false, "distinct inputs");
});

Deno.test("sha256Hex: unicode input (Arabic) known vector", async () => {
  assertEquals(
    await sha256Hex("مسار X"),
    "3fd87912041b5013fd5d27c73b8b5588220507d2b8188c9006c729d802daab4d",
    "sha256(unicode) via UTF-8 encoding",
  );
});

// ---------------------------------------------------------------------------
// SHA-1
// ---------------------------------------------------------------------------

Deno.test("sha1Hex: 'abc' known vector (RFC 3174)", async () => {
  assertEquals(
    await sha1Hex("abc"),
    "a9993e364706816aba3e25717850c26c9cd0d89d",
    "sha1('abc')",
  );
});

Deno.test("sha1Hex: empty string known vector", async () => {
  assertEquals(
    await sha1Hex(""),
    "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    "sha1('')",
  );
});

Deno.test("sha1Hex: output shape and determinism", async () => {
  const first = await sha1Hex("public_id=avatars/x_1&timestamp=1700000000test-secret");
  assertHex(first, 40, "sha1 output");
  assertEquals(await sha1Hex("public_id=avatars/x_1&timestamp=1700000000test-secret"), first, "deterministic");
});

Deno.test("sha1Hex: unicode input digests without error", async () => {
  const digest = await sha1Hex("مسار X");
  assertHex(digest, 40, "sha1 unicode output");
  assertEquals(digest !== (await sha1Hex("masar X")), true, "unicode matters");
});
