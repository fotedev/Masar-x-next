import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

import { getAdminDb } from '@/lib/admin-db';
import { profiles } from '@/lib/admin-db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Verify that user is authenticated and is an admin
  const supabase = await createClient();
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminDb = getAdminDb();
  const rows = await adminDb
    .select({
      id: profiles.id,
      username: profiles.username,
      fullName: profiles.fullName,
      updatedAt: profiles.updatedAt,
    })
    .from(profiles)
    .limit(5);

  return NextResponse.json({ count: rows.length, rows });
}
