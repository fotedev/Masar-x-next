// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { nanoid } from "https://esm.sh/nanoid@3";
import { corsHeaders } from "../_shared/cors.ts";

// =====================
// Brevo configuration
// =====================
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') || 'masarx.eg@gmail.com';
const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') || 'مسار X';

// =====================
// Helpers
// =====================
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
}

// =====================
// Email sender
// =====================
async function sendPasswordResetEmail(email: string, resetToken: string) {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://masarx.vercel.app";
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  console.log(`[AUTH] Preparing password reset email for: ${email}`);

  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is missing in environment variables");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is missing in environment variables");
  }

  const subject = "إعادة تعيين كلمة المرور - مسار X";
  const title = "إعادة تعيين كلمة المرور";
  const bodyText = "تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك. يرجى النقر على الزر أدناه للمتابعة.";
  const buttonText = "إعادة تعيين كلمة المرور";

  const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: 'Cairo', Arial, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">مسار X</h1>
              <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 18px;">رفيقك في رحلة التعلم</p>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin: 0 0 24px 0; font-size: 24px; font-weight: 700; text-align: center;">${title}</h2>

              <p style="color: #4b5563; line-height: 1.6; font-size: 16px; margin-bottom: 24px; text-align: center;">
                مرحباً،<br>
                ${bodyText}
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}"
                   style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                          color: white;
                          padding: 16px 32px;
                          text-decoration: none;
                          border-radius: 12px;
                          font-weight: 700;
                          font-size: 16px;
                          display: inline-block;
                          box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5);
                          transition: all 0.3s ease;">
                  ${buttonText}
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
                إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.
              </p>

              <div style="border-top: 1px solid #e5e7eb; margin: 32px 0 24px 0;"></div>

              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; text-align: center; margin: 0;">
                إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:<br>
                <a href="${resetUrl}" style="color: #3b82f6; text-decoration: none; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                &copy; ${new Date().getFullYear()} مسار X. جميع الحقوق محفوظة.
              </p>
            </div>
          </div>
        </body>
        </html>
        `;

  const payload = {
    sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
    to: [{ email }],
    subject: subject,
    htmlContent: htmlContent,
  };

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error(`Brevo API Error for ${email}:`, JSON.stringify(err, null, 2));
    throw new Error(`Brevo error: ${err?.message || response.statusText}`);
  }
  console.log(`Password reset email successfully sent to: ${email}`);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
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
      const ip = getClientIp(req);
      console.log(`[AUTH] Processing password reset request for: ${email} from IP: ${ip}`);

      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !serviceKey) {
        console.error("[AUTH] Missing environment variables");
        throw new Error(`Supabase env missing: URL=${!!supabaseUrl}, KEY=${!!serviceKey}`);
      }

      const supabase = createClient(supabaseUrl, serviceKey);

      // =====================
      // Get user by email (safe lookup)
      // =====================
      let user;

      if (typeof supabase.auth.admin.getUserByEmail === 'function') {
        const { data: userResult, error: userError } = await supabase.auth.admin.getUserByEmail(email);
        if (userError) {
          console.error(`[AUTH] getUserByEmail error for ${email}:`, userError);
        } else {
          user = userResult?.user;
          console.log(`[AUTH] User search result for ${email}: ${user ? 'Found ID: ' + user.id : 'Not Found'}`);
          if (!user) {
            console.log(`[AUTH] No user found for email: ${email}`);
            return new Response(
              JSON.stringify({
                success: true,
                debug: "No user found in auth.users",
                message: "إذا كان البريد الإلكتروني مسجل في النظام، ستتلقى رسالة إعادة التعيين",
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        }
      }

      // Security: Always return success to prevent email enumeration
      const successResponse = new Response(
        JSON.stringify({
          success: true,
          message: "إذا كان البريد الإلكتروني مسجل في النظام، ستتلقى رسالة إعادة التعيين",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

      if (!user) {
        return successResponse;
      }

      // =====================
      // Rate limit check (basic abuse protection)
      // =====================
      try {
        const { data: allowed, error: rlError } = await supabase.rpc('check_rate_limit', {
          p_identifier: email,
          p_endpoint: 'request-password-reset',
          p_max_requests: 3,
          p_window_minutes: 1440,
        });
        
        if (rlError) {
          console.warn('[AUTH] Rate limit check failed:', rlError.message);
        } else if (allowed === false) {
          console.warn(`[AUTH] Rate limit exceeded for email: ${email}`);
          return new Response(
            JSON.stringify({ error: 'Too many requests. Try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (rlEx) {
        console.warn('[AUTH] Rate limit exception:', rlEx);
      }

      console.log(`[AUTH] Generating reset token for user: ${user.id}`);

      const resetToken = nanoid(32);
      const tokenHash = await sha256(resetToken);

      const tokenData = {
        user_id: user.id,
        email,
        token: resetToken,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };
      
      console.log(`[AUTH] Inserting password reset token for user: ${user.id}`);

      // Use direct REST API with service role key to bypass RLS and library issues
      const restUrl = `${supabaseUrl}/rest/v1/password_reset_tokens`;
      
      const restResponse = await fetch(restUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(tokenData)
      });

      const restStatus = restResponse.status;
      const responseText = await restResponse.text();

      if (!restResponse.ok) {
        console.error(`[AUTH] REST API insert failed: Status ${restStatus}`, responseText);
        // CRITICAL: Do not send email if database insert failed
        throw new Error(`Failed to save password reset token in database: ${restStatus} ${responseText}`);
      }
      
      console.log(`[AUTH] Password reset token inserted successfully for email: ${email}`);
      
      console.log(`[AUTH] Sending password reset email to: ${email}`);
      try {
        await sendPasswordResetEmail(email, resetToken);
        console.log(`[AUTH] Password reset email sent successfully to: ${email}`);
      } catch (emailErr) {
        console.error(`[AUTH] Failed to send password reset email:`, emailErr);
        throw emailErr;
      }

      return successResponse;
    } catch (err) {
      console.error("[AUTH] request-password-reset error:", err);
      return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
});
