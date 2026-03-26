import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/admin-db';
import { profiles } from '@/lib/admin-db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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
