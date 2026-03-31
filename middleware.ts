import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./src/i18n/routing";
import { updateSession } from "./src/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

function isRedirectResponse(response: NextResponse | null | undefined) {
  if (!response) return false;
  if (response.headers.has("location")) return true;
  return [301, 302, 303, 307, 308].includes(response.status);
}

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const intlResponse = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;
  console.debug(`[middleware] Setting x-pathname header to: "${pathname}"`);

  // Preserve redirects/rewrite responses as-is.
  if (
    intlResponse &&
    (intlResponse.headers.has("location") ||
      [301, 302, 303, 307, 308].includes(intlResponse.status))
  ) {
    intlResponse.headers.set("x-pathname", pathname);
    const setCookie = sessionResponse.headers.get("set-cookie");
    if (setCookie) intlResponse.headers.append("set-cookie", setCookie);
    return intlResponse;
  }

  if (isRedirectResponse(sessionResponse)) {
    sessionResponse.headers.set("x-pathname", pathname);
    const setCookie = intlResponse?.headers.get("set-cookie");
    if (setCookie) sessionResponse.headers.append("set-cookie", setCookie);
    return sessionResponse;
  }

  // Make pathname available to `next-intl` request config via *response headers* as well
  // to ensure consistency across both request and response flow.
  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });
  
  response.headers.set("x-pathname", pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  
  const finalResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const baseResponse = intlResponse ?? sessionResponse;
  baseResponse.headers.forEach((value: string, key: string) => {
    if (key.toLowerCase() === "set-cookie") return;
    finalResponse.headers.set(key, value);
  });

  const intlSetCookie = intlResponse?.headers.get("set-cookie");
  if (intlSetCookie) finalResponse.headers.append("set-cookie", intlSetCookie);
  const sessionSetCookie = sessionResponse.headers.get("set-cookie");
  if (sessionSetCookie) finalResponse.headers.append("set-cookie", sessionSetCookie);

  finalResponse.headers.set("x-pathname", pathname);
  return finalResponse;
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
    "/((?!monitoring|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|llms.txt|googlec58e80c40bab6a9f.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
