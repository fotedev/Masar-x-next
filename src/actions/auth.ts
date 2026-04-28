'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminDb } from '@/lib/admin-db';
import { profiles } from '@/lib/admin-db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

/**
 * Synchronizes the user profile with the database.
 * Merges OAuth metadata on first sign-in but preserves custom database changes.
 */
export async function syncUserProfile() {
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
    const adminDb = getAdminDb();
    
    // 1. Check if profile exists
    const [existingProfile] = await adminDb
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!existingProfile) {
      logger.info(`[auth/sync] Creating new profile for user ${user.id}`);
      // 2. Create profile if it doesn't exist (First sign-in)
      await adminDb.insert(profiles).values({
        id: user.id,
        fullName: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatarUrl: user.user_metadata?.avatar_url || null,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // 3. Selective sync: Only update if fields are empty to avoid overwriting custom edits
      const updates: any = {};
      if (!existingProfile.fullName && (user.user_metadata?.full_name || user.user_metadata?.name)) {
        updates.fullName = user.user_metadata?.full_name || user.user_metadata?.name;
      }
      if (!existingProfile.avatarUrl && user.user_metadata?.avatar_url) {
        updates.avatarUrl = user.user_metadata?.avatar_url;
      }

      if (Object.keys(updates).length > 0) {
        logger.info(`[auth/sync] Updating existing profile for user ${user.id}`, updates);
        await adminDb
          .update(profiles)
          .set({ ...updates, updatedAt: new Date().toISOString() })
          .where(eq(profiles.id, user.id));
      }
    }

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: any) {
    logger.error('[auth/sync] Database sync failed:', {
      error: error.message,
      code: error.code,
      userId: user.id
    });
    
    // Check for specific connectivity issues to provide better feedback in development
    const isDev = process.env.NODE_ENV === 'development';
    const errorMessage = isDev ? `Sync failed: ${error.message}` : 'Internal server error';
    
    return { success: false, error: errorMessage };
  }
}
