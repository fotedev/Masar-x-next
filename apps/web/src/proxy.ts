import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { defineRouting } from "next-intl/routing";

import { updateSession } from "./lib/supabase/proxy";
import { logger } from "./lib/logger";

const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
  localeDetection: true,
});

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

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const lower = host.toLowerCase();

  // IPv6 loopback — the Host header for an IPv6 literal is bracketed and
  // has the port after the closing bracket: `[::1]:3000`. Strip the
  // bracketed part first, then check the literal. We also accept a bare
  // `::1` (non-conformant per RFC 9110, but some clients send it that
  // way and treating it as loopback is the safer default).
  if (lower.startsWith("[")) {
    const end = lower.indexOf("]");
    if (end < 0) return false;
    const literal = lower.slice(1, end);
    if (literal === "::1") return true;
    return false;
  }
  if (lower === "::1") return true;

  // Strip the port for IPv4 / hostname (Host is `hostname[:port]` per RFC 9110).
  const hostname = lower.split(":", 1)[0] ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }
  // IPv4 loopback range 127.0.0.0/8.
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  return false;
}

function getCspHeader(nonce: string, host: string | null = null): string {
  // Use a more robust check for production environment at the edge
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const isDev = !isProd;
  const isLocal = isLocalHost(host);

  const cspDirectives = [
    // Allow YouTube and Google Video in default-src to cover media/workers
    "default-src 'self' https://*.youtube.com https://*.googlevideo.com",

    // script-src: nonce for inline scripts; unsafe-eval only in dev (react-refresh / HMR
    // needs eval). In production we add 'wasm-unsafe-eval' instead — a much narrower
    // directive that only permits WebAssembly compilation/instantiation, so the
    // dotlottie-web WASM can be compiled even if Vercel serves it with the wrong
    // MIME type (which forces the library to fall back from instantiateStreaming
    // to instantiate, the latter requiring WebAssembly access). Much safer than
    // the full 'unsafe-eval' because arbitrary eval() is still blocked.
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : " 'wasm-unsafe-eval'"} https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.youtube.com https://s.ytimg.com`,

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

    // frame-src: YouTube embeds + Cloudinary document reader iframes
    // (the desktop workspace embeds PDF/image URLs served from
    // https://res.cloudinary.com — see apps/web/src/components/desktop/workspace/
    // DocumentReader.tsx and apps/web/src/lib/cloudinary.ts).
    "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://res.cloudinary.com",

    // worker-src: blob workers (e.g. PDF.js, Lottie)
    "worker-src 'self' blob:",

    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // `upgrade-insecure-requests` is correct for production (real Vercel HTTPS
    // domain) but breaks the Electron desktop runtime: the local Next.js
    // server is plain HTTP on 127.0.0.1:<port>, and upgrading to HTTPS makes
    // Chromium emit ERR_SSL_PROTOCOL_ERROR. Suppress only for loopback hosts.
    ...(isLocal ? [] : ["upgrade-insecure-requests"]),
  ];

  return cspDirectives.join("; ");
}

function addSecurityHeaders(response: NextResponse, nonce: string, host: string | null = null): void {
  // CSP with nonce. Pass the request Host so we can suppress
  // `upgrade-insecure-requests` for the desktop's loopback server (see
  // getCspHeader).
  response.headers.set("Content-Security-Policy", getCspHeader(nonce, host));
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

// Set-Cookie values must move one header at a time: `headers.get("set-cookie")`
// returns the edge runtime's comma-joined view of every Set-Cookie on the
// source response, and re-appending that string collapses Supabase's chunked
// session cookies (`sb-*-auth-token.0/.1` + verifier) into a single
// unparseable header (audit H1). `getSetCookie()` returns them individually.
function appendSetCookies(target: Headers, source: Headers): void {
  for (const cookie of source.getSetCookie()) {
    target.append("set-cookie", cookie);
  }
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const nonce = generateNonce();
  const host = request.headers.get("host");

  try {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    requestHeaders.set("x-nonce", nonce);

    const sessionResponse = await updateSession(request);
    const intlResponse = intlMiddleware(request);

    if (intlResponse && isRedirectResponse(intlResponse)) {
      intlResponse.headers.set("x-pathname", pathname);
      addSecurityHeaders(intlResponse, nonce, host);

      appendSetCookies(intlResponse.headers, sessionResponse.headers);

      return intlResponse;
    }

    if (isRedirectResponse(sessionResponse)) {
      sessionResponse.headers.set("x-pathname", pathname);
      addSecurityHeaders(sessionResponse, nonce, host);

      if (intlResponse) {
        appendSetCookies(sessionResponse.headers, intlResponse.headers);
      }

      return sessionResponse;
    }

    // Rebuild from the post-updateSession request: updateSession may have
    // rotated the auth cookies via request.cookies.set, and the downstream
    // RSC/Server-Action render must see the refreshed cookies — forwarding
    // the pre-refresh clone made the server re-refresh with an already
    // consumed token, which Supabase's reuse detection can punish by
    // revoking the whole session family (audit H2, the "randomly logged
    // out" signature).
    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set("x-pathname", pathname);
    forwardedHeaders.set("x-nonce", nonce);

    const finalResponse = NextResponse.next({
      request: {
        headers: forwardedHeaders,
      },
    });

    const baseResponse = intlResponse ?? sessionResponse;
    baseResponse.headers.forEach((value: string, key: string) => {
      if (key.toLowerCase() === "set-cookie") return;
      finalResponse.headers.set(key, value);
    });

    if (intlResponse) {
      appendSetCookies(finalResponse.headers, intlResponse.headers);
    }
    appendSetCookies(finalResponse.headers, sessionResponse.headers);

    finalResponse.headers.set("x-pathname", pathname);
    addSecurityHeaders(finalResponse, nonce, host);
    return finalResponse;
  } catch (error) {
    // On proxy error, log and pass through to page (don't block request)
    logger.error("Proxy error", error, {
      pathname,
    });

    // Return a response that allows the request to proceed
    // The page can handle any remaining auth checks
    const fallbackNonce = generateNonce();
    const fallbackHost = request.headers.get("host");

    // The fallback forwards the request WITH the same nonce it signs the
    // CSP with — previously the forwarded headers carried no x-nonce while
    // the CSP nonce existed, so ThemeScript and every inline bootstrap
    // script were blocked on the error path (audit M1).
    const fallbackHeaders = new Headers(request.headers);
    fallbackHeaders.set("x-pathname", pathname);
    fallbackHeaders.set("x-nonce", fallbackNonce);

    const fallbackResponse = NextResponse.next({
      request: {
        headers: fallbackHeaders,
      },
    });
    fallbackResponse.headers.set("x-middleware-error", "true");
    addSecurityHeaders(fallbackResponse, fallbackNonce, fallbackHost);

    return fallbackResponse;
  }
}

export const config = {
  matcher: [
    // sw.js is excluded so the PWA ServiceWorker can register from
    // /sw.js without being locale-redirected by next-intl. ServiceWorker
    // spec forbids scripts behind redirects, so any redirect on the SW
    // URL breaks registration on production.
    //
    // .wasm is excluded so the dotlottie-web WebAssembly blob at
    // /dotlottie-player.wasm is served by Next.js as a static file
    // instead of being routed through the proxy. Without this,
    // next-intl's locale detection treats the request as a missing
    // locale and returns the HTML 404 page (which starts with
    // `<!DOCTYPE html>`), and the library's WebAssembly.instantiate()
    // blows up with "expected magic word 00 61 73 6d, found 3c 21
    // 44 4f" because it's trying to parse HTML as a binary module.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|animations|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wasm)$).*)",
  ],
};
