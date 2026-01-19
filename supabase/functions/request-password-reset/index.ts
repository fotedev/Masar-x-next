// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { nanoid } from "https://esm.sh/nanoid@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// =====================
// Brevo configuration
// =====================
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// =====================
// Email sender
// =====================
async function sendPasswordResetEmail(email: string, resetToken: string) {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://masar-x.vercel.app";
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is missing in environment variables");
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "مسار X", email: "masarx.eg@gmail.com" },
      to: [{ email }],
      subject: "إعادة تعيين كلمة المرور - مسار X",
      htmlContent: `تم طلب إعادة تعيين كلمة المرور.<br><a href="${resetUrl}">إعادة التعيين</a>`,
      textContent: `إعادة تعيين كلمة المرور:\n${resetUrl}`,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Brevo error: ${err?.message || response.statusText}`);
  }
}

// =====================
// Edge Function
// =====================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      throw new Error(`Supabase env missing: URL=${!!supabaseUrl}, KEY=${!!serviceKey}`);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // =====================
    // Get user by email (safe lookup)
    // =====================
    let user;

    // Try getUserByEmail (available in newer versions of supabase-js)
    if (typeof supabase.auth.admin.getUserByEmail === 'function') {
      const { data: userResult, error: userError } = await supabase.auth.admin.getUserByEmail(email);
      if (userError) {
        console.warn("getUserByEmail failed, trying listUsers fallback:", userError.message);
      } else {
        user = userResult?.user;
      }
    }

    // Fallback if getUserByEmail is missing or failed
    if (!user) {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        throw new Error(`Auth error: ${listError.message}`);
      }
      user = users.find(u => u.email === email);
    }

    if (!user) {
      // Security: do NOT reveal existence
      return new Response(
        JSON.stringify({
          success: true,
          message:
            "إذا كان البريد الإلكتروني مسجل في النظام، ستتلقى رسالة إعادة التعيين",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resetToken = nanoid(32);

    const { error: insertError } = await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      email,
      token: resetToken,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    await sendPasswordResetEmail(email, resetToken);

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "إذا كان البريد الإلكتروني مسجل في النظام، ستتلقى رسالة إعادة التعيين",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("request-password-reset error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
