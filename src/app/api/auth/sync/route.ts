import { NextResponse } from 'next/server';
import { syncUserProfile } from '@/actions/auth';

/**
 * Endpoint to trigger profile sync after login.
 * This can be called from client-side after successful auth.
 */
export async function POST() {
  const result = await syncUserProfile();
  
  if (result.success) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
}
