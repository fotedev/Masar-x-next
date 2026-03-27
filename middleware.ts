import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./src/i18n/routing";
import { updateSession } from "./src/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const intlResponse = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;

  // Preserve redirects/rewrite responses as-is.
  if (
    intlResponse &&
    (intlResponse.headers.has("location") ||
      [301, 302, 303, 307, 308].includes(intlResponse.status))
  ) {
    intlResponse.headers.set("x-masarx-pathname", pathname);
    const setCookie = sessionResponse.headers.get("set-cookie");
    if (setCookie) intlResponse.headers.append("set-cookie", setCookie);
    return intlResponse;
  }

  // Make pathname available to `next-intl` request config via *request headers*.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-masarx-pathname", pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const baseResponse = intlResponse ?? sessionResponse;
  baseResponse.headers.forEach((value: string, key: string) => {
    if (key.toLowerCase() === "set-cookie") return;
    response.headers.set(key, value);
  });

  const intlSetCookie = intlResponse?.headers.get("set-cookie");
  if (intlSetCookie) response.headers.append("set-cookie", intlSetCookie);
  const sessionSetCookie = sessionResponse.headers.get("set-cookie");
  if (sessionSetCookie) response.headers.append("set-cookie", sessionSetCookie);

  response.headers.set("x-masarx-pathname", pathname);

  return response;
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
