// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { buildCorsHeaders } from '../_shared/cors.ts';
import { corsPreflight, jsonResponse } from '../_shared/http.ts';
import { createAdminClient } from '../_shared/auth.ts';
import { checkRateLimit, getClientIp } from '../_shared/net.ts';
import { verifyCloudinaryWebhookSignature } from './signature.ts';

type AdminRow = {
  user_id: string;
};

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return corsPreflight(req)
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405, { 'Allow': 'POST, OPTIONS' })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(req, { error: 'Missing Supabase environment variables' }, 500)
    }

    const supabase = createAdminClient()

    const cloudinaryApiSecret = Deno.env.get('CLOUDINARY_API_SECRET') ?? ''
    if (!cloudinaryApiSecret) {
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Cloudinary signs the exact request bytes. Read once as text so parsing JSON
    // cannot change whitespace or ordering after the signature check.
    const rawBody = await req.text()
    const signatureResult = await verifyCloudinaryWebhookSignature({
      rawBody,
      timestampHeader: req.headers.get('x-cld-timestamp'),
      signatureHeader: req.headers.get('x-cld-signature'),
      apiSecret: cloudinaryApiSecret,
    })

    if (!signatureResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    let payload: Record<string, unknown>
    try {
      const parsedPayload = JSON.parse(rawBody)
      if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
        throw new Error('Invalid JSON payload')
      }
      payload = parsedPayload
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Basic rate limit by IP to reduce abuse
    try {
      const ip = getClientIp(req);
      const allowed = await checkRateLimit(supabase, {
        identifier: ip,
        endpoint: 'cloudinary-webhook',
        maxRequests: 120,
        windowMinutes: 1,
      });

      if (allowed === false) {
        return new Response(
          JSON.stringify({ error: 'Too many requests' }),
          { status: 429, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
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
        { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ message: 'Webhook processed successfully' }),
      { headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Webhook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    )
  }
})