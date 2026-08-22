import { NextResponse } from 'next/server';
import { syncUserProfile } from '@/actions/auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs'; // Ensure we use Node.js runtime for full DB support

/**
 * Endpoint to trigger profile sync after login.
 * This can be called from client-side after successful auth.
 *
 * NOTE: This route does NOT use DATABASE_URL directly — it goes through
 * Supabase JS client. The previous DATABASE_URL pre-check was a leftover
 * from an old Drizzle/pg implementation and incorrectly returned 503.
 */
export async function POST() {
  try {
    const result = await syncUserProfile();
    
    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      logger.error('[api/auth/sync] Sync failed:', result.error);
      return NextResponse.json(
        { 
          error: 'Synchronization failed', 
          detail: result.error,
          timestamp: new Date().toISOString() 
        }, 
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error('[api/auth/sync] Unexpected route error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        // DIAGNOSTIC MODE (hotfix/auth-sync-diag): always expose error.message
        // to surface root cause in /api/auth/sync 500s. Will be reverted.
        detail: error?.message ?? String(error),
        code: (error as { code?: string })?.code,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
