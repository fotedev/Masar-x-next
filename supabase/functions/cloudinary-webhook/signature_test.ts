import {
  CLOUDINARY_SIGNATURE_TOLERANCE_SECONDS,
  verifyCloudinaryWebhookSignature,
} from "./signature.ts";

const BODY = '{"notification_type":"upload","public_id":"masarx/test"}';
const TIMESTAMP = "1780289000";
const API_SECRET = "test-api-secret";
const SHA1_SIGNATURE = "a850ad9d6d46ca4156ea3850e18bbf197f5a0a26";
const SHA256_SIGNATURE =
  "0bb3ecdea72fece44f0ca72da548e6ad80ff16785296ece18beca75a3ce5fe49";
const NOW_MILLISECONDS = Number(TIMESTAMP) * 1000;

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function verify(
  overrides: Partial<Parameters<typeof verifyCloudinaryWebhookSignature>[0]> =
    {},
) {
  return verifyCloudinaryWebhookSignature({
    rawBody: BODY,
    timestampHeader: TIMESTAMP,
    signatureHeader: SHA1_SIGNATURE,
    apiSecret: API_SECRET,
    nowMilliseconds: NOW_MILLISECONDS,
    ...overrides,
  });
}

Deno.test("accepts Cloudinary SHA-1 notification signatures", async () => {
  assertEquals(await verify(), { valid: true });
});

Deno.test("accepts Cloudinary SHA-256 notification signatures", async () => {
  assertEquals(
    await verify({ signatureHeader: SHA256_SIGNATURE }),
    { valid: true },
  );
});

Deno.test("rejects a signature calculated for a different body", async () => {
  assertEquals(
    await verify({ rawBody: `${BODY} ` }),
    { valid: false, reason: "invalid_signature" },
  );
});

Deno.test("rejects a signature calculated with a different secret", async () => {
  assertEquals(
    await verify({ apiSecret: "wrong-api-secret" }),
    { valid: false, reason: "invalid_signature" },
  );
});

Deno.test("rejects missing signature headers", async () => {
  assertEquals(
    await verify({ signatureHeader: null }),
    { valid: false, reason: "missing_headers" },
  );
});

Deno.test("rejects malformed and non-hex signatures", async () => {
  assertEquals(
    await verify({ signatureHeader: "not-hex" }),
    { valid: false, reason: "invalid_signature" },
  );
});

Deno.test("rejects stale and future timestamps", async () => {
  const toleranceMilliseconds = CLOUDINARY_SIGNATURE_TOLERANCE_SECONDS * 1000;
  assertEquals(
    await verify({
      nowMilliseconds: NOW_MILLISECONDS + toleranceMilliseconds + 1000,
    }),
    { valid: false, reason: "stale_timestamp" },
  );
  assertEquals(
    await verify({
      nowMilliseconds: NOW_MILLISECONDS - toleranceMilliseconds - 1000,
    }),
    { valid: false, reason: "stale_timestamp" },
  );
});
