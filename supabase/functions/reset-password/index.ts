// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from '../_shared/cors.ts';
import { corsPreflight } from '../_shared/http.ts';
import { createAdminClient } from '../_shared/auth.ts';
import { sha256Hex } from '../_shared/crypto.ts';
import { checkRateLimit, getClientIp } from '../_shared/net.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return corsPreflight(req);
  }

  try {
    const body = await req.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Token and new password are required" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Clean token - remove any trailing :number (React dev artifact)
    const cleanToken = token.replace(/:\d+$/, '');
    const tokenHash = await sha256Hex(cleanToken);

    // Create Supabase client with service role key
    const supabaseAdmin = createAdminClient();

    // Basic rate limit by IP
    try {
      const ip = getClientIp(req);
      const allowed = await checkRateLimit(supabaseAdmin, {
        identifier: ip,
        endpoint: 'reset-password',
        maxRequests: 30,
        windowMinutes: 1,
      });
      if (allowed === false) {
        return new Response(
          JSON.stringify({ error: 'Too many requests. Try again later.' }),
          { status: 429, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      // allow on error
    }

    // Verify the token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("user_id, email, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset token" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (tokenData.used_at) {
      return new Response(
        JSON.stringify({ error: "Token has already been used" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token has expired" }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Find the user by email (avoid listUsers: expensive and abusable)
    let userId: string | null = null;
    if (typeof supabaseAdmin.auth.admin.getUserByEmail === 'function') {
      const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserByEmail(tokenData.email);
      if (userError) {
        return new Response(
          JSON.stringify({ error: "Failed to find user" }),
          {
            status: 500,
            headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }
      userId = userResult?.user?.id ?? null;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 404,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update password" }),
        {
          status: 500,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Mark token as used
    const { error: markError } = await supabaseAdmin
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", tokenHash);

    if (markError) {
      console.warn("Failed to mark token as used:", markError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "تم تحديث كلمة المرور بنجاح" }),
      {
        status: 200,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in reset-password function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});