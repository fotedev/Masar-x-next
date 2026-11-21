/**
 * Locale-resolved access to the tenant's ZANE prompt platform name.
 *
 * Spec 055: ZANE must identify as the *active* tenant (ANU-X vs Masar X),
 * so prompt builders resolve the platform brand from the `faculty` preset
 * (`promptPlatformName` key — a dedicated prompt-specific string that can
 * drift independently of the marketing `displayName`). Same discipline as
 * canned-messages.ts: non-React module, static JSON imports
 * (resolveJsonModule), locale picked from what the caller already holds.
 *
 * The core fallback is NOT a preset string: callers keep their own
 * hardcoded core default ("مسار X" / "Masar X") when this returns
 * undefined, so a deployment without NEXT_PUBLIC_FACULTY renders the
 * exact pre-055 prompt.
 */

import { resolveFacultyPresetIdFromEnv } from "masarx-shared";
import arFaculty from "masarx-shared/messages/ar/faculty.json";
import enFaculty from "masarx-shared/messages/en/faculty.json";

type FacultyPromptTable = Record<string, { promptPlatformName?: string }>;

/**
 * The active tenant's prompt platform name, or undefined for core
 * branding (no preset / unknown env / missing key). Locale prefix pick
 * mirrors `cannedMessagesFor` ("ar" prefix → ar table, else en).
 */
export const getFacultyPromptBrand = (locale?: string): string | undefined => {
  const facultyId = resolveFacultyPresetIdFromEnv();
  if (!facultyId) return undefined;
  const table: FacultyPromptTable = (locale || "ar")
    .toLowerCase()
    .startsWith("ar")
    ? arFaculty
    : enFaculty;
  const value = table[facultyId]?.promptPlatformName;
  return typeof value === "string" && value.trim() ? value : undefined;
};
