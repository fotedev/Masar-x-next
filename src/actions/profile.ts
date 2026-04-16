'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminDb } from '@/lib/admin-db';
import { profiles } from '@/lib/admin-db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Updates a user's profile information.
 * Uses Drizzle for type-safe database mutations.
 */
export async function updateProfile(_prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Not authenticated' };

  try {
    const fullName = formData.get('fullName') as string;
    const username = formData.get('username') as string;
    const website = formData.get('website') as string;
    const avatarUrl = formData.get('avatarUrl') as string;

    const adminDb = getAdminDb();
    
    // Perform upsert (onConflictDoUpdate pattern)
    await adminDb.insert(profiles).values({
      id: user.id,
      fullName: fullName || null,
      username: username || null,
      website: website || null,
      avatarUrl: avatarUrl || null,
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: profiles.id,
      set: {
        fullName: fullName || null,
        username: username || null,
        website: website || null,
        avatarUrl: avatarUrl || null,
        updatedAt: new Date().toISOString(),
      }
    });

    // Optionally sync with auth metadata (not required, but helpful for client-side use)
    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        display_name: fullName,
        avatar_url: avatarUrl,
        custom_avatar: avatarUrl,
      }
    });

    revalidatePath('/', 'layout');
    return { success: true, message: 'Profile updated successfully' };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Specialized update for profile avatar.
 */
export async function updateAvatar(avatarUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Not authenticated' };

  try {
    const adminDb = getAdminDb();
    
    await adminDb.update(profiles)
      .set({ avatarUrl, updatedAt: new Date().toISOString() })
      .where(eq(profiles.id, user.id));

    // Keep auth metadata in sync to prevent flickering (fallback source)
    await supabase.auth.updateUser({
      data: { 
        avatar_url: avatarUrl,
        custom_avatar: avatarUrl 
      }
    });

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    console.error('Error updating avatar:', error);
    return { success: false, error: 'Internal server error' };
  }
}
