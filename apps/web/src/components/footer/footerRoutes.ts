// Footer route scope (owner decision 2026-11-20): the footer distracts
// students while they study, so it renders ONLY on info/utility routes.
// Everything not listed here — including all future studying pages — is
// footer-free by default; when a new info page ships, add it to this set.
//
// Exact-match against the locale-stripped pathname computed in Layout.tsx
// (e.g. "/ar/subjects" -> "/subjects"), so nested studying routes such as
// "/subjects/<id>" or "/trw/<category>/<course>" never match by prefix.
export const FOOTER_ROUTES: ReadonlySet<string> = new Set([
  "/", // home / landing
  "/news",
  "/downloads",
  "/faq",
  "/privacy-policy",
  "/privacy-details",
  "/login",
  "/signup",
  "/reset-password",
  "/onboarding/academic",
  "/profile",
  "/unauthorized",
  "/add-file", // contributor forms are utility pages
  "/add-video",
  "/edit-summary",
  "/trw/redeem",
  "/trw/my-access",
]);

export function isFooterRoute(
  pathWithoutLocale: string | null | undefined,
): boolean {
  return pathWithoutLocale != null && FOOTER_ROUTES.has(pathWithoutLocale);
}
