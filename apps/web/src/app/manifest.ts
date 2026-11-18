import type { MetadataRoute } from "next";
import {
  resolveFacultyPresetIdFromEnv,
  type FacultyMessagesTable,
} from "masarx-shared";
import facultyMessages from "masarx-shared/messages/en/faculty.json";
import pwaMessages from "masarx-shared/messages/ar/pwa.json";

const FACULTY_STRINGS = facultyMessages as FacultyMessagesTable;

// Spec 052: generated PWA manifest (replaces public/manifest.json).
// name/short_name follow the active faculty preset (unset = core "Masar
// X"); the description and shortcut labels come from the `pwa` i18n
// namespace (the frozen BRANDING.md §2 definition) and the icons are the
// §7 production assets — identical on every deployment. The manifest is
// the AR-flavored artifact it always was (lang/dir unchanged); Next.js
// serves it at /manifest.webmanifest AND auto-injects the
// <link rel="manifest"> head tag the static file never had.
export default function manifest(): MetadataRoute.Manifest {
  const facultyId = resolveFacultyPresetIdFromEnv();
  const preset = facultyId ? FACULTY_STRINGS[facultyId] : null;

  return {
    name: preset?.displayName ?? "Masar X",
    short_name: preset?.shortName ?? "Masar X",
    description: pwaMessages.manifestDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait",
    scope: "/",
    lang: "ar",
    dir: "rtl",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: pwaMessages.manifestShortcutSummaries,
        short_name: pwaMessages.manifestShortcutSummariesShort,
        description: pwaMessages.manifestShortcutSummariesDescription,
        url: "/?tab=summaries",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: pwaMessages.manifestShortcutNews,
        short_name: pwaMessages.manifestShortcutNewsShort,
        description: pwaMessages.manifestShortcutNewsDescription,
        url: "/?tab=news",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
