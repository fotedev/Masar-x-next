import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Verify that user is authenticated and is an admin using getUser() for JWT verification
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: adminRow } = await supabase
    .from('admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('id, username, full_name, updated_at')
    .limit(5);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch profiles', detail: error.message },
      { status: 500 },
    );
  }

  // Map snake_case → camelCase for the admin dashboard consumer.
  const rows = ((data as Array<{
    id: string;
    username: string | null;
    full_name: string | null;
    updated_at: string | null;
  }> | null) ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({ count: rows.length, rows });
}
