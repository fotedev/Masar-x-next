// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { user, email_data } = payload;
    const { token, token_hash, redirect_to, email_action_type } = email_data;

    console.log(`Processing ${email_action_type} email for ${user.email}`);

    // Determine subject and content based on email type
    let subject = '';
    let title = '';
    let bodyText = '';
    let buttonText = '';
    let actionUrl = '';

    // Construct the action URL
    // For signup/recovery, Supabase usually provides a link or we construct it
    // The hook payload provides token or token_hash
    // Standard Supabase confirmation link: {{ .SiteURL }}/auth/v1/verify?token={{ .TokenHash }}&type=signup&redirect_to={{ .RedirectTo }}

    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    switch (email_action_type) {
      case 'signup':
        subject = 'تأكيد التسجيل - مسار X';
        title = 'تأكيد حسابك';
        bodyText = 'شكراً لانضمامك إلى منصة مسار X! يرجى النقر على الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك.';
        buttonText = 'تأكيد الحساب';
        actionUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=signup&redirect_to=${redirect_to}`;
        break;
      case 'recovery':
        subject = 'إعادة تعيين كلمة المرور - مسار X';
        title = 'إعادة تعيين كلمة المرور';
        bodyText = 'تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك. يرجى النقر على الزر أدناه للمتابعة.';
        buttonText = 'إعادة تعيين كلمة المرور';
        actionUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=recovery&redirect_to=${redirect_to}`;
        break;
      case 'magiclink':
        subject = 'رابط تسجيل الدخول - مسار X';
        title = 'تسجيل الدخول السريع';
        bodyText = 'انقر على الزر أدناه لتسجيل الدخول إلى حسابك مباشرة.';
        buttonText = 'تسجيل الدخول';
        actionUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=magiclink&redirect_to=${redirect_to}`;
        break;
      case 'email_change':
        subject = 'تغيير البريد الإلكتروني - مسار X';
        title = 'تأكيد تغيير البريد الإلكتروني';
        bodyText = 'لقد طلبت تغيير بريدك الإلكتروني. يرجى النقر على الزر أدناه لتأكيد البريد الجديد.';
        buttonText = 'تأكيد التغيير';
        actionUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=email_change&redirect_to=${redirect_to}`;
        break;
      default:
        subject = 'إشعار من مسار X';
        title = 'إشعار جديد';
        bodyText = 'لديك إشعار جديد بخصوص حسابك.';
        buttonText = 'انقر هنا';
        actionUrl = redirect_to;
    }

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
                <a href="${actionUrl}"
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
                إذا لم تطلب هذا الإجراء، يمكنك تجاهل هذا الإيميل.
              </p>

              <div style="border-top: 1px solid #e5e7eb; margin: 32px 0 24px 0;"></div>

              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; text-align: center; margin: 0;">
                إذا كنت تواجه مشكلة في النقر على الزر، انسخ الرابط التالي والصقه في متصفحك:<br>
                <a href="${actionUrl}" style="color: #3b82f6; text-decoration: none; word-break: break-all;">${actionUrl}</a>
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

    const emailResponse = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'مسار X - منصة الملخصات',
          email: 'masarx.eg@gmail.com'
        },
        to: [{ email: user.email }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Brevo API error:', errorData);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in auth-hook-email:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
