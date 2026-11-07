/**
 * Unit tests for ../../upload-file/pure.ts (spec 040 Wave 6) — the pure
 * logic extracted verbatim from upload-file/index.ts serve().
 * Zero dependencies: plain Deno.test + local assert (runs offline, no stubs).
 */
import {
  estimateBase64Size,
  exceedsMaxUploadSize,
  extractCloudinaryErrorMessage,
  isAllowedContentType,
  MAX_UPLOAD_BYTES,
  sanitizeFileName,
} from "../../upload-file/pure.ts";

function assertEquals(actual: unknown, expected: unknown, msg: string): void {
  if (actual !== expected) {
    throw new Error(
      `${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// isAllowedContentType
// ---------------------------------------------------------------------------

Deno.test("isAllowedContentType: every allowlisted type passes", () => {
  for (const type of [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/tiff",
    "image/bmp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
  ]) {
    assertEquals(isAllowedContentType(type), true, type);
  }
});

Deno.test("isAllowedContentType: executables, archives variants, lookalikes -> false", () => {
  for (const type of [
    "application/x-msdownload",
    "application/x-httpd-php",
    "text/html",
    "application/javascript",
    "application/octet-stream",
    "application/x-zip", // NOT in the allowlist (only zip + x-zip-compressed)
    "image/svg+xml",
    "image/jpg", // canonical name differs from image/jpeg
    "", // empty
  ]) {
    assertEquals(isAllowedContentType(type), false, JSON.stringify(type));
  }
});

// ---------------------------------------------------------------------------
// Base64 size estimation vs the 50MB limit
// ---------------------------------------------------------------------------

Deno.test("estimateBase64Size: length * 0.75", () => {
  assertEquals(estimateBase64Size("A".repeat(400)), 300, "400 chars -> 300 bytes");
  assertEquals(estimateBase64Size(""), 0, "empty string");
  assertEquals(estimateBase64Size("AB"), 1.5, "fractional estimate is kept as-is");
});

Deno.test("exceedsMaxUploadSize: under / at / over the 50MB line", () => {
  assertEquals(MAX_UPLOAD_BYTES, 50 * 1024 * 1024, "limit constant pinned");
  const atLimit = String.fromCharCode(65).repeat(MAX_UPLOAD_BYTES / 0.75); // estimate == limit
  assertEquals(exceedsMaxUploadSize(atLimit), false, "exactly at limit is allowed (strict >)");
  assertEquals(
    exceedsMaxUploadSize(atLimit + "A"),
    true,
    "one char over the line is rejected",
  );
  assertEquals(exceedsMaxUploadSize("c2hvcnQ="), false, "tiny payload allowed");
});

// ---------------------------------------------------------------------------
// sanitizeFileName
// ---------------------------------------------------------------------------

Deno.test("sanitizeFileName: keeps safe charset, replaces the rest with '_'", () => {
  assertEquals(sanitizeFileName("lecture-notes.pdf"), "lecture-notes.pdf", "safe name untouched");
  assertEquals(sanitizeFileName("my file (1).docx"), "my_file__1_.docx", "spaces + parens");
  assertEquals(sanitizeFileName("مسار X.pdf"), "_____X.pdf", "Arabic letters replaced");
  assertEquals(sanitizeFileName("../etc/passwd"), ".._etc_passwd", "path traversal defanged");
  assertEquals(sanitizeFileName("a/b\\c:d*e?f\"g<h>i|j.k"), "a_b_c_d_e_f_g_h_i_j.k", "windows-unsafe");
  assertEquals(sanitizeFileName(""), "", "empty stays empty");
});

// ---------------------------------------------------------------------------
// extractCloudinaryErrorMessage
// ---------------------------------------------------------------------------

Deno.test("extractCloudinaryErrorMessage: top-level message wins", () => {
  assertEquals(
    extractCloudinaryErrorMessage({ message: "Upload preset not found" }),
    "Upload preset not found",
    "top-level",
  );
});

Deno.test("extractCloudinaryErrorMessage: falls back to nested error.message", () => {
  assertEquals(
    extractCloudinaryErrorMessage({ error: { message: "Invalid API key" } }),
    "Invalid API key",
    "nested",
  );
});

Deno.test("extractCloudinaryErrorMessage: blank top-level message falls through to nested", () => {
  assertEquals(
    extractCloudinaryErrorMessage({ message: "   ", error: { message: "nested wins" } }),
    "nested wins",
    "blank message is treated as absent",
  );
  assertEquals(
    extractCloudinaryErrorMessage({ message: "", error: { message: 42 } }),
    "Unknown error",
    "non-string nested message -> unknown",
  );
});

Deno.test("extractCloudinaryErrorMessage: garbage shapes -> 'Unknown error'", () => {
  assertEquals(extractCloudinaryErrorMessage(null), "Unknown error", "null");
  assertEquals(extractCloudinaryErrorMessage(undefined), "Unknown error", "undefined");
  assertEquals(extractCloudinaryErrorMessage("some raw text"), "Unknown error", "plain string");
  assertEquals(extractCloudinaryErrorMessage(42), "Unknown error", "number");
  assertEquals(extractCloudinaryErrorMessage({}), "Unknown error", "empty object");
  assertEquals(extractCloudinaryErrorMessage({ error: "not-an-object" }), "Unknown error", "scalar error field");
});
