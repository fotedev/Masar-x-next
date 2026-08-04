import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Database connectivity check. Migrated from pg + Drizzle (`SELECT 1`)
 * to a Supabase JS service-role round-trip. The latency is now measured
 * over HTTPS/PostgREST, not raw TCP, so it's a "supabase api reachable"
 * probe rather than a pure DB ping — documented in the response.
 */
export async function GET() {
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
