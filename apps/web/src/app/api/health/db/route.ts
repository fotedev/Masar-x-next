import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// P1-8 hardening (audit 2026-09-18): the probe used to be fully open, letting
// anyone enumerate DB reachability/latency and hold the pool with requests.
// Same contract as /api/mcp: fail-closed in production without a secret.
let healthSecretWarned = false;

function isAuthorized(request: Request): boolean {
  const secret = process.env.HEALTH_CHECK_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    if (!healthSecretWarned) {
      healthSecretWarned = true;
      logger.error(
        "[health/db] HEALTH_CHECK_SECRET is not set in production; /api/health/db returns 403 until configured. " +
          "Set it in the Vercel project env to enable uptime probes.",
      );
    }
    return false;
  }
  // Dev/preview: missing secret = open so local checks work without setup.
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Database connectivity check. Migrated from pg + Drizzle (`SELECT 1`)
 * to a Supabase JS service-role round-trip. The latency is now measured
 * over HTTPS/PostgREST, not raw TCP, so it's a "supabase api reachable"
 * probe rather than a pure DB ping — documented in the response.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const start = Date.now();
  try {
    const admin = getSupabaseAdmin();

    // Minimal query that touches the database through the PostgREST layer.
    // `head: true` returns no rows but still validates auth + connectivity.
    const { error } = await admin
      .from("profiles")
      .select("id", { head: true })
      .limit(1);

    const duration = Date.now() - start;

    if (error) {
      return NextResponse.json(
        {
          status: "unhealthy",
          database: "disconnected",
          error: error.message,
          code: error.code,
          latency: `${duration}ms`,
          probe: "supabase-rest",
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      latency: `${duration}ms`,
      probe: "supabase-rest",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const duration = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[health/db] Connectivity check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        error: message,
        latency: `${duration}ms`,
        probe: "supabase-rest",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
