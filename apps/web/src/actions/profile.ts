"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { ProfileFormSchema } from "@/lib/validation/profile";
import { logger } from "@/lib/logger";

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
    const validationResult = ProfileFormSchema.shape.avatarUrl.safeParse(avatarUrl);
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
