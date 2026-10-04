/**
 * Unit tests for ../avatar-id.ts (P0 delete-avatar hotfix).
 * Zero dependencies: plain Deno.test + local assert (runs offline).
 */
import {
  extractCloudinaryPublicId,
  isOwnedAvatarPublicId,
} from "../avatar-id.ts";

function assertEquals(actual: unknown, expected: unknown, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const UID = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";

Deno.test("extract: versioned avatar URL -> namespaced public_id", () => {
  assertEquals(
    extractCloudinaryPublicId(
      `https://res.cloudinary.com/demo/image/upload/v1712345678/avatars/${UID}_1712345678.jpg`,
    ),
    `avatars/${UID}_1712345678`,
    "versioned url",
  );
});

Deno.test("extract: unversioned URL works", () => {
  assertEquals(
    extractCloudinaryPublicId(
      `https://res.cloudinary.com/demo/image/upload/avatars/${UID}_1712345678.png`,
    ),
    `avatars/${UID}_1712345678`,
    "unversioned url",
  );
});

Deno.test("extract: rejects non-cloudinary host", () => {
  assertEquals(
    extractCloudinaryPublicId(`https://evil.example.com/image/upload/avatars/${UID}_1.jpg`),
    null,
    "foreign host",
  );
});

Deno.test("extract: rejects http scheme", () => {
  assertEquals(
    extractCloudinaryPublicId(`http://res.cloudinary.com/demo/image/upload/avatars/${UID}_1.jpg`),
    null,
    "http scheme",
  );
});

Deno.test("extract: rejects garbage / missing extension / missing marker", () => {
  assertEquals(extractCloudinaryPublicId("not a url"), null, "garbage");
  assertEquals(
    extractCloudinaryPublicId(`https://res.cloudinary.com/demo/image/upload/avatars/${UID}_1`),
    null,
    "no extension",
  );
  assertEquals(
    extractCloudinaryPublicId(`https://res.cloudinary.com/demo/image/avatars/${UID}_1.jpg`),
    null,
    "no /upload/ marker",
  );
});

Deno.test("ownership: own namespace passes", () => {
  assertEquals(isOwnedAvatarPublicId(`avatars/${UID}_1712345678`, UID), true, "own id");
});

Deno.test("ownership: user B cannot claim user A id (the P0 case)", () => {
  assertEquals(isOwnedAvatarPublicId(`avatars/${UID}_1712345678`, OTHER), false, "cross-user");
});

Deno.test("ownership: wrong folder / traversal / separators rejected", () => {
  assertEquals(isOwnedAvatarPublicId(`other/${UID}_1`, UID), false, "wrong folder");
  assertEquals(isOwnedAvatarPublicId(`avatars/../${UID}_1`, UID), false, "traversal");
  assertEquals(isOwnedAvatarPublicId(`avatars/${UID}_1/extra`, UID), false, "separator");
  assertEquals(isOwnedAvatarPublicId(`avatars/${UID}_`, UID), false, "empty suffix");
  assertEquals(isOwnedAvatarPublicId("", UID), false, "empty");
});
