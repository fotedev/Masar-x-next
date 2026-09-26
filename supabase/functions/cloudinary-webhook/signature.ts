export const CLOUDINARY_SIGNATURE_TOLERANCE_SECONDS = 2 * 60 * 60;

type SignatureAlgorithm = "SHA-1" | "SHA-256";

export type CloudinarySignatureVerification =
  | { valid: true }
  | {
    valid: false;
    reason: "missing_headers" | "invalid_signature" | "stale_timestamp";
  };

function decodeHex(value: string): Uint8Array | null {
  if (
    value.length === 0 || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)
  ) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(
  expected: Uint8Array,
  received: Uint8Array,
): boolean {
  if (expected.length !== received.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index] ^ received[index];
  }
  return difference === 0;
}

function getSignatureAlgorithm(signature: string): SignatureAlgorithm | null {
  if (signature.length === 40) return "SHA-1";
  if (signature.length === 64) return "SHA-256";
  return null;
}

/**
 * Verify a Cloudinary notification signature over the exact raw HTTP body.
 *
 * Cloudinary signs `body + timestamp + api_secret` with the account's
 * configured signature algorithm (SHA-1 by default, SHA-256 optionally).
 * This is a keyed digest construction, not HMAC.
 */
export async function verifyCloudinaryWebhookSignature(options: {
  rawBody: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  apiSecret: string;
  nowMilliseconds?: number;
  toleranceSeconds?: number;
}): Promise<CloudinarySignatureVerification> {
  const {
    rawBody,
    timestampHeader,
    signatureHeader,
    apiSecret,
    nowMilliseconds = Date.now(),
    toleranceSeconds = CLOUDINARY_SIGNATURE_TOLERANCE_SECONDS,
  } = options;

  if (!timestampHeader || !signatureHeader) {
    return { valid: false, reason: "missing_headers" };
  }

  if (!/^\d{1,12}$/.test(timestampHeader)) {
    return { valid: false, reason: "invalid_signature" };
  }

  const timestampSeconds = Number(timestampHeader);
  const nowSeconds = Math.floor(nowMilliseconds / 1000);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds
  ) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const algorithm = getSignatureAlgorithm(signatureHeader);
  const receivedDigest = decodeHex(signatureHeader);
  if (!algorithm || !receivedDigest) {
    return { valid: false, reason: "invalid_signature" };
  }

  const signedPayload = `${rawBody}${timestampHeader}${apiSecret}`;
  const expectedDigest = new Uint8Array(
    await crypto.subtle.digest(
      algorithm,
      new TextEncoder().encode(signedPayload),
    ),
  );

  return constantTimeEqual(expectedDigest, receivedDigest)
    ? { valid: true }
    : { valid: false, reason: "invalid_signature" };
}
