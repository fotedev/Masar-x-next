import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";
import { logger } from "./lib/logger";

const intlMiddleware = createMiddleware(routing);

function isRedirectResponse(response: NextResponse | null | undefined) {
  if (!response) return false;
  if (response.headers.has("location")) return true;
  return [301, 302, 303, 307, 308].includes(response.status);
}

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";

  const cspDirectives = [
    // Allow YouTube and Google Video in default-src to cover media/workers
    "default-src 'self' https://*.youtube.com https://*.googlevideo.com",

    // script-src: nonce for inline scripts; unsafe-eval only in dev (react-refresh / HMR needs eval)
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""} https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.youtube.com https://s.ytimg.com`,

    // style-src: unsafe-inline is required because:
    //   1. Nonces cannot be applied to `style="…"` attributes (only to <style> elements).
    //   2. The app uses many dynamic inline styles (progress bars, animations, etc.).
    //   When a nonce IS present alongside unsafe-inline, CSP3 ignores unsafe-inline for
    //   <style> elements but unsafe-inline is still the only way to allow style attributes.
    //   Dropping the nonce from style-src keeps the rule straightforward.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    // img-src: allow all https sources for remote images (Cloudinary, Supabase, Google, etc.)
    "img-src 'self' data: blob: https:",

    "font-src 'self' https://fonts.gstatic.com data:",

    // connect-src: all external API / realtime / CDN endpoints the app talks to
    [
      "connect-src 'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://*.googleapis.com",
      "https://*.googleusercontent.com",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
      "https://raw.githubusercontent.com",
      "https://www.google-analytics.com",
      "https://*.vercel.app",
      "https://res.cloudinary.com",
      "https://*.youtube.com",
      "https://*.googlevideo.com",
      "https://api.puter.com",
      "wss://api.puter.com",
      "https://*.puter.com",
      "wss://*.puter.com",
      "https://lottie.host",
      "https://cdn.jsdelivr.net",
      "https://www.transparenttextures.com",
    ].join(" "),

    // frame-src: YouTube embeds
    "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://*.youtube.com",

    // worker-src: blob workers (e.g. PDF.js, Lottie)
    "worker-src 'self' blob:",

    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ];

  return cspDirectives.join("; ");
}

function addSecurityHeaders(response: NextResponse, nonce: string): void {
  // CSP with nonce
  response.headers.set("Content-Security-Policy", getCspHeader(nonce));
  response.headers.set("x-nonce", nonce);

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
}

export default async function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;
    const nonce = generateNonce();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    requestHeaders.set("x-nonce", nonce);

    const sessionResponse = await updateSession(request);
    const intlResponse = intlMiddleware(request);

    if (intlResponse && isRedirectResponse(intlResponse)) {
      intlResponse.headers.set("x-pathname", pathname);
      addSecurityHeaders(intlResponse, nonce);

      const sessionSetCookie = sessionResponse.headers.get("set-cookie");
      if (sessionSetCookie)
        intlResponse.headers.append("set-cookie", sessionSetCookie);

      return intlResponse;
    }

    if (isRedirectResponse(sessionResponse)) {
      sessionResponse.headers.set("x-pathname", pathname);
      addSecurityHeaders(sessionResponse, nonce);

      const intlSetCookie = intlResponse?.headers.get("set-cookie");
      if (intlSetCookie)
        sessionResponse.headers.append("set-cookie", intlSetCookie);

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
    if (intlSetCookie)
      finalResponse.headers.append("set-cookie", intlSetCookie);

    const sessionSetCookie = sessionResponse.headers.get("set-cookie");
    if (sessionSetCookie)
      finalResponse.headers.append("set-cookie", sessionSetCookie);

    finalResponse.headers.set("x-pathname", pathname);
    addSecurityHeaders(finalResponse, nonce);
    return finalResponse;
  } catch (error) {
    // On middleware error, log and pass through to page (don't block request)
    logger.error("Middleware error", error, {
      pathname: request.nextUrl.pathname,
    });

    // Return a response that allows the request to proceed
    // The page can handle any remaining auth checks
    const pathname = request.nextUrl.pathname;
    const fallbackResponse = NextResponse.next({
      request: {
        headers: new Headers(request.headers),
      },
    });
    fallbackResponse.headers.set("x-pathname", pathname);
    fallbackResponse.headers.set("x-middleware-error", "true");
    return fallbackResponse;
  }
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
