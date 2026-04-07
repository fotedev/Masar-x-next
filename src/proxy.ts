import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

function isRedirectResponse(response: NextResponse | null | undefined) {
  if (!response) return false;
  if (response.headers.has("location")) return true;
  return [301, 302, 303, 307, 308].includes(response.status);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const sessionResponse = await updateSession(request);
  const intlResponse = intlMiddleware(request);

  if (intlResponse && isRedirectResponse(intlResponse)) {
    intlResponse.headers.set("x-pathname", pathname);

    const sessionSetCookie = sessionResponse.headers.get("set-cookie");
    if (sessionSetCookie) intlResponse.headers.append("set-cookie", sessionSetCookie);

    return intlResponse;
  }

  if (isRedirectResponse(sessionResponse)) {
    sessionResponse.headers.set("x-pathname", pathname);

    const intlSetCookie = intlResponse?.headers.get("set-cookie");
    if (intlSetCookie) sessionResponse.headers.append("set-cookie", intlSetCookie);

    return sessionResponse;
  }

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
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
