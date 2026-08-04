// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from '../_shared/cors.ts';

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
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
    const tokenDataBytes = new TextEncoder().encode(cleanToken);
    const tokenHashBuffer = await crypto.subtle.digest('SHA-256', tokenDataBytes);
    const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Basic rate limit by IP
    try {
      const ip = getClientIp(req);
      const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', {
        p_identifier: ip,
        p_endpoint: 'reset-password',
        p_max_requests: 30,
        p_window_minutes: 1,
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