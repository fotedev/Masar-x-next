import { NextResponse } from 'next/server';
import { syncUserProfile } from '@/actions/auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs'; // Ensure we use Node.js runtime for full DB support

/**
 * Endpoint to trigger profile sync after login.
 * This can be called from client-side after successful auth.
 */
export async function POST() {
  // Check for database configuration early
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_IPV4) {
    logger.error('[api/auth/sync] DATABASE_URL not configured');
    return NextResponse.json(
      {
        error: 'Database not configured',
        detail: 'DATABASE_URL or DATABASE_URL_IPV4 environment variable is missing',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }

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
        detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}
