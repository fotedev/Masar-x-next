"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { ProfileSchema } from "@/lib/validation/profile";
import { logger } from "@/lib/logger";

/**
 * Updates a user's profile information.
 *
 * Migrated from pg + Drizzle to Supabase JS service-role client because
 * the pg driver's native TLS module is not reliably externalized by
 * Next.js 16 dev (webpack) on Windows.
 */
export async function updateProfile(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  try {
    const fullName = formData.get("fullName") as string;
    const username = formData.get("username") as string;
    const website = formData.get("website") as string;
    const avatarUrl = formData.get("avatarUrl") as string;

    const validationResult = ProfileSchema.safeParse({
      fullName,
      username,
      website,
      avatarUrl,
    });

    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      validationResult.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      });

      return {
        success: false,
        error: "Validation failed",
        fieldErrors,
      };
    }

    const admin = getSupabaseAdmin();

    // Upsert pattern: try insert, fall back to update on conflict.
    // Cast `as never` to bypass Supabase JS v2.97 generic inference bug.
    const { error: upsertError } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          full_name: fullName || null,
          username: username || null,
          website: website || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "id" },
      );

    if (upsertError) throw upsertError;

    // Optionally sync with auth metadata (not required, but helpful for client-side use)
    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        display_name: fullName,
        avatar_url: avatarUrl,
        custom_avatar: avatarUrl,
      },
    });

    revalidatePath("/", "layout");
    return { success: true, message: "Profile updated successfully" };
  } catch (error) {
    logger.error("Error updating user profile", error);
    return { success: false, error: "Internal server error" };
  }
}

/**
 * Specialized update for profile avatar.
 */
export async function updateAvatar(avatarUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  try {
    // Validate avatarUrl
    const validationResult = ProfileSchema.shape.avatarUrl.safeParse(avatarUrl);
    if (!validationResult.success) {
      return {
        success: false,
        error:
          validationResult.error.issues[0]?.message || "Invalid avatar URL",
      };
    }

    const admin = getSupabaseAdmin();

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", user.id);

    if (updateError) throw updateError;

    // Keep auth metadata in sync to prevent flickering (fallback source)
    await supabase.auth.updateUser({
      data: {
        avatar_url: avatarUrl,
        custom_avatar: avatarUrl,
      },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    logger.error("Error updating avatar", error);
    return { success: false, error: "Internal server error" };
  }
}
