import { NextResponse, type NextRequest } from "next/server";

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * R18 (review 2026-11-07): the Electron desktop serves this app from a
 * loopback Next standalone server. A DNS-rebinding page could reach
 * `127.0.0.1:<port>` with an attacker-chosen Host header, and the standalone
 * server does no Host validation of its own. In desktop mode (marked by
 * MASARX_DESKTOP_LOOPBACK=1, set by apps/desktop/src/main/server.ts at
 * spawn) reject any request whose Host is not loopback — fail closed when
 * the Host header is missing.
 *
 * Gated on the env marker so the Vercel deployment and `next dev` are
 * untouched. The env is read at request time: on a self-hosted standalone
 * server the runtime env is visible to middleware (nothing is inlined at
 * build time for non-NEXT_PUBLIC vars).
 */
export function middleware(request: NextRequest) {
  if (process.env.MASARX_DESKTOP_LOOPBACK !== "1") {
    return NextResponse.next();
  }

  const rawHost = request.headers.get("host") ?? "";
  // Host is authority-form ("hostname:port"); normalize both variants.
  const hostname = rawHost
    .replace(/:\d+$/, "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .toLowerCase();

  if (LOOPBACK_HOSTNAMES.has(hostname)) {
    return NextResponse.next();
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
