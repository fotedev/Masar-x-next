// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts";

type AdminRow = {
  user_id: string;
};

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    )

    const payload = await req.json()

    // التحقق من API Key للأمان
    const webhookKey = req.headers.get('x-api-key')
    const expectedKey = Deno.env.get('CLOUDINARY_WEBHOOK_KEY')

    if (!expectedKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (webhookKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Basic rate limit by IP to reduce abuse
    try {
      const ip = getClientIp(req);
      const { data: allowed } = await supabase.rpc('check_rate_limit', {
        p_identifier: ip,
        p_endpoint: 'cloudinary-webhook',
        p_max_requests: 120,
        p_window_minutes: 1,
      });

      if (allowed === false) {
        return new Response(
          JSON.stringify({ error: 'Too many requests' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch {
      // allow on error
    }

    console.log('Cloudinary webhook received:', payload)

    if (payload.notification_type === 'upload') {
      // حفظ الملف في قاعدة البيانات
      const { data: summary, error } = await supabase
        .from('summaries')
        .insert({
          title: payload.public_id || 'ملف جديد',
          pdf_url: payload.url,
          status: 'pending',
          subject: payload.tags?.[0] || 'غير محدد',
          year: payload.tags?.[1] || 'غير محدد',
          department: payload.tags?.[2] || 'ذكاء اصطناعي',
          content: `تم رفع الملف عبر Cloudinary: ${payload.public_id}`,
          contributor_name: payload.context?.custom?.contributor || null
        })
        .select()
        .single()

      if (error) throw error

      // إرسال إشعار للمدراء
      const { data: admins } = await supabase
        .from('admins')
        .select('user_id')

      if (admins && admins.length > 0) {
        const notifications = (admins as AdminRow[]).map((admin) => ({
          user_id: admin.user_id,
          title: "ملف جديد مرفوع ",
          message: `تم رفع "${payload.public_id}" وينتظر المراجعة`,
          type: "admin_submission",
          related_id: summary.id,
          related_type: "summary",
          read: false
        }))

        await supabase.from('notifications').insert(notifications)
      }

      return new Response(
        JSON.stringify({ success: true, summary_id: summary.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Webhook processed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})