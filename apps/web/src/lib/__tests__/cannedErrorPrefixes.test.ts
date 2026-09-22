import { describe, it, expect } from "vitest";
import { CANNED_ERROR_PREFIXES } from "../ai/canned-messages";
import arMessages from "masarx-shared/messages/ar/aiAssistant.json";
import enMessages from "masarx-shared/messages/en/aiAssistant.json";

/**
 * Contract guard for the chat's error styling (ChatMessageItem): canned AI
 * errors are RESOLVED content, so the amber error box recognizes them purely
 * by their leading emoji prefix. These tests lock the contract so a reworded
 * or newly added canned error that drops the marker cannot silently skip the
 * amber path. ChatMessageItem imports the SAME CANNED_ERROR_PREFIXES constant.
 */

type Canned = typeof arMessages.canned;
const locales = { ar: arMessages.canned, en: enMessages.canned } as const;

// Keys whose content is an AI-service failure → rendered in the amber box.
const AMBER_KEYS: (keyof Canned)[] = [
  "claudeFallback",
  "claudeFallbackShort",
  "serviceUnavailable",
  "serviceUnavailableShort",
  "genericError",
  "insufficientFunds",
  "puterUnavailable",
];
// Key routed through the Puter auth flow (marker stripped before the emoji).
const AUTH_MARKER_KEY: keyof Canned = "needsLogin";
const PUTER_AUTH_MARKER = "__PUTER_AUTH_REQUIRED__";
// Informational canned replies that must render as normal content.
const INFO_KEYS: (keyof Canned)[] = ["noPlatformContext", "groupRagNoData"];

describe("canned error prefix contract", () => {
  it("classifies every canned key — a new key fails until it is assigned a bucket", () => {
    for (const [locale, canned] of Object.entries(locales)) {
      const all = Object.keys(canned).sort();
      const classified = [...AMBER_KEYS, AUTH_MARKER_KEY, ...INFO_KEYS].sort();
      const unclassified = all.filter((k) => !(classified as string[]).includes(k));
      const message =
        `${locale}: unclassified canned key(s): ${unclassified.join(", ") || "none"}. ` +
        `Add the new canned message from aiAssistant.json to AMBER_KEYS (AI-service failure — ` +
        `then make its content start with a CANNED_ERROR_PREFIX emoji), AUTH_MARKER_KEY ` +
        `(Puter auth flow), or INFO_KEYS (normal reply) in cannedErrorPrefixes.test.ts.`;
      expect(unclassified, message).toEqual([]);
    }
  });

  it("every amber error key starts with a CANNED_ERROR_PREFIX in both locales", () => {
    for (const [locale, canned] of Object.entries(locales)) {
      for (const key of AMBER_KEYS) {
        expect(
          CANNED_ERROR_PREFIXES.some((p) => canned[key].startsWith(p)),
          `${locale}.${key} must start with one of [${CANNED_ERROR_PREFIXES.join(", ")}]`,
        ).toBe(true);
      }
    }
  });

  it("the auth-marker key carries the marker and a warning emoji after it", () => {
    for (const [locale, canned] of Object.entries(locales)) {
      const content = canned[AUTH_MARKER_KEY];
      expect(content.startsWith(PUTER_AUTH_MARKER), `${locale}.${AUTH_MARKER_KEY} marker`).toBe(true);
      const afterMarker = content.slice(content.indexOf("\n") + 1);
      expect(CANNED_ERROR_PREFIXES.some((p) => afterMarker.startsWith(p))).toBe(true);
    }
  });

  it("informational canned replies do NOT start with an error prefix (no false amber box)", () => {
    for (const [locale, canned] of Object.entries(locales)) {
      for (const key of INFO_KEYS) {
        expect(
          CANNED_ERROR_PREFIXES.some((p) => canned[key].startsWith(p)),
          `${locale}.${key} must not be classified as an error`,
        ).toBe(false);
      }
    }
  });
});
