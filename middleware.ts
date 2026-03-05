import { type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./src/i18n/routing";
import { updateSession } from "./src/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const intlResponse = intlMiddleware(request);
  if (intlResponse) {
    const setCookie = sessionResponse.headers.get("set-cookie");
    if (setCookie) intlResponse.headers.append("set-cookie", setCookie);

    return intlResponse;
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|llms.txt|googlec58e80c40bab6a9f.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
