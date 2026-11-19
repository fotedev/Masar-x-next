/**
 * Faculty white-label presets — spec 052.
 *
 * One codebase, many faculty deployments: a Vercel project sets
 * `NEXT_PUBLIC_FACULTY=<preset-id>` and every brand surface (metadata,
 * PWA manifest, footer) renders that faculty's sub-brand. Unset (or
 * unknown) values fall back to the core "Masar X" branding so the main
 * deployment is untouched.
 *
 * The per-faculty *strings* live in the `faculty` i18n namespace
 * (`packages/shared/src/messages/{ar,en}/faculty.json`) — i18n invariant
 * I3; this module only carries the id mechanics and the string-shape
 * contract. Dependency-free by design (safe in Next server + client,
 * Electron, React Native), same discipline as src/i18n/index.ts.
 */

/** Ids of the faculty presets declared in `faculty.json` (ar + en). */
export const FACULTY_PRESET_IDS = ["fcai-asnu", "bis"] as const;

export type FacultyPresetId = (typeof FACULTY_PRESET_IDS)[number];

/** Shape of one preset's strings inside the `faculty` i18n namespace. */
export interface FacultyStrings {
  /** Full public name, e.g. "FCAI ASNU X" (SEO/og/footer brand title). */
  displayName: string;
  /** Compact name, e.g. "ASNU X" (PWA manifest short_name). */
  shortName: string;
  /** Default document title for the instance (bilingual per locale). */
  seoTitle: string;
  /** Title-template suffix, e.g. "%s | FCAI ASNU X". */
  titleSuffix: string;
  /** Footer line crediting the master brand, e.g. "Powered by Masar X". */
  poweredBy: string;
}

/** The `faculty` namespace table as imported from `faculty.json`. */
export type FacultyMessagesTable = Record<FacultyPresetId, FacultyStrings>;

/**
 * Resolve a raw faculty value to a preset id, or null for "core branding".
 *
 * Unknown values never throw: they warn in development and fall back to
 * core, so a typo'd env var degrades to the main brand instead of
 * crashing a deployment.
 */
export function resolveFacultyPresetId(
  raw?: string | null,
): FacultyPresetId | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if ((FACULTY_PRESET_IDS as readonly string[]).includes(value)) {
    return value as FacultyPresetId;
  }
  warnDev(
    `[masarx-shared/branding] Unknown NEXT_PUBLIC_FACULTY "${raw}" — ` +
      `expected one of: ${FACULTY_PRESET_IDS.join(", ")}. ` +
      "Falling back to core Masar X branding.",
  );
  return null;
}

/**
 * Read the active faculty preset from the environment. `NEXT_PUBLIC_*`
 * values are inlined at build time (Vercel per-project), so this is
 * stable for both the server and the client bundle.
 */
export function resolveFacultyPresetIdFromEnv(): FacultyPresetId | null {
  if (typeof process === "undefined" || process.env === undefined) return null;
  return resolveFacultyPresetId(process.env.NEXT_PUBLIC_FACULTY);
}

/** Dev-only console.warn. Silent in production builds of every runtime. */
function warnDev(message: string): void {
  if (
    typeof process !== "undefined" &&
    process.env !== undefined &&
    process.env.NODE_ENV !== "production"
  ) {
    console.warn(message);
  }
}
