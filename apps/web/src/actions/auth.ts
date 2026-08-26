'use server';

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

/**
 * Synchronizes the user profile with the database.
 * Merges OAuth metadata on first sign-in but preserves custom database changes.
 *
 * Uses the Supabase JS service-role client instead of pg + Drizzle,
 * because the pg driver's native TLS module is not reliably externalized
 * by Next.js 16 dev (webpack) on Windows — the connection fails with
 * `There was an error establishing an SSL connection`.
 */
export async function syncUserProfile() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('[auth/sync] Supabase not configured: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
    return { success: false, error: 'Database not configured' };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) {
    logger.error('[auth/sync] Supabase auth error:', authError);
    return { success: false, error: 'Authentication failed' };
  }

  if (!user) {
    logger.warn('[auth/sync] No user session found');
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const admin = getSupabaseAdmin();

    // 1. Check if profile exists
    const { data: existingProfileRaw, error: selectError } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    // Cast to a concrete shape — Supabase JS v2.97's generic inference
    // resolves the untyped admin client result to `never`.
    const existingProfile = existingProfileRaw as {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    } | null;

    if (!existingProfile) {
      logger.info(`[auth/sync] Creating new profile for user ${user.id}`);
      // Cast payload to `never` to bypass Supabase JS v2.97's broken generic
      // inference on insert. The runtime contract is unchanged.
      const { error: insertError } = await admin
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
        } as never);
      if (insertError) throw insertError;
    } else {
      // 3. Selective sync: Only update if fields are empty to avoid overwriting custom edits
      const updates: Record<string, string> = {};
      const oauthFullName = user.user_metadata?.full_name || user.user_metadata?.name;
      if (!existingProfile.full_name && oauthFullName) {
        updates.full_name = oauthFullName;
      }
      if (!existingProfile.avatar_url && user.user_metadata?.avatar_url) {
        updates.avatar_url = user.user_metadata?.avatar_url;
      }

      if (Object.keys(updates).length > 0) {
        logger.info(`[auth/sync] Updating existing profile for user ${user.id}`, updates);
        const { error: updateError } = await admin
          .from('profiles')
          .update(updates as never)
          .eq('id', user.id);
        if (updateError) throw updateError;
      }
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: unknown) {
    // Supabase PostgREST errors are plain objects { message, code, details, hint },
    // NOT Error instances — so `String(error)` becomes "[object Object]".
    // Extract the structured fields first, then fall back to generic handling.
    const errObj = error as { message?: string; code?: string; details?: string; hint?: string };
    const message =
      errObj?.message ??
      (error instanceof Error ? error.message : JSON.stringify(error));
    const code = errObj?.code;
    const details = errObj?.details;
    const hint = errObj?.hint;

    logger.error('[auth/sync] Database sync failed:', {
      error: message,
      code,
      details,
      hint,
      userId: user.id,
    });

    const isDev = process.env.NODE_ENV === 'development';
    const errorMessage = isDev ? `Sync failed: ${message}` : 'Internal server error';

    return { success: false, error: errorMessage };
  }
}
