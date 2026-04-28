import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/admin-db/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getAdminDb();
    
    // Simple query to verify connectivity
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const duration = Date.now() - start;

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      latency: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[health/db] Connectivity check failed:", error);
    
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
