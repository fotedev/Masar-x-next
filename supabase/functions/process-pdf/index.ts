// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCorsHeaders } from '../_shared/cors.ts';
import { getBearerToken } from '../_shared/auth.ts';
import {
  isAllowedDnsAnswer,
  resolveRedirectTarget,
  validateFetchUrl,
} from '../_shared/ssrf-guard.ts';

// P0 hotfix: this function used to fetch ANY caller-supplied URL with no
// authentication (unauthed SSRF + unbounded buffering). verify_jwt alone is
// not sufficient (the anon key is itself a valid JWT), so auth.getUser()
// must resolve a real user, and every fetch hop is allowlisted,
// DNS-validated, size-capped and timed out. See _shared/ssrf-guard.ts.

interface OCRRequest {
  pdfUrl: string;
}

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MiB
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MINUTES = 60;

function extraHosts(): string[] {
  const raw = (Deno.env.get('PDF_FETCH_EXTRA_HOSTS') ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/\.$/, ''))
    .filter((h) => h.length > 0);
  return [...new Set(raw)];
}

async function hostResolvesPublic(hostname: string): Promise<boolean> {
  // Fail-closed: any DNS failure or any non-public answer rejects the host.
  // NOTE (residual TOCTOU): an answer is validated at resolve time; a
  // fast-flux/DNS-rebinding name can still change between check and connect.
  // Manual redirect handling + short timeouts narrow this; a connect-level
  // egress control would close it fully (follow-up).
  try {
    const [a, aaaa] = await Promise.all([
      Deno.resolveDns(hostname, 'A').catch(() => [] as string[]),
      Deno.resolveDns(hostname, 'AAAA').catch(() => [] as string[]),
    ]);
    const answers = [...a, ...aaaa];
    if (answers.length === 0) return false;
    return answers.every(isAllowedDnsAnswer);
  } catch {
    return false;
  }
}

async function readCappedBytes(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

// Exported for handler-level tests (see _shared/tests/handler-process-pdf.test.ts,
// run with --allow-env --import-map to stub remote imports). Production entry
// stays identical: supabase serves this file as main.
export async function handleProcessPdf(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) })
  }

  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ success: false, error }), {
      status,
      headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
    });

  try {
    // ---- 1. Authenticate: bearer token must resolve to a real user ----
    const token = getBearerToken(req);
    if (!token) return deny(401, 'Unauthorized');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) return deny(401, 'Unauthorized');

    // ---- 2. Per-user rate limit (fail-open with warning, repo convention) ----
    try {
      const rlClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );
      const { data: allowed, error: rlError } = await rlClient.rpc('check_rate_limit', {
        p_identifier: user.id,
        p_endpoint: 'process-pdf',
        p_max_requests: RATE_LIMIT_MAX,
        p_window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      });
      if (rlError) {
        console.warn('[process-pdf] rate-limit check failed, allowing:', user.id);
      } else if (allowed === false) {
        return deny(429, 'Too many requests');
      }
    } catch {
      console.warn('[process-pdf] rate-limit exception, allowing:', user.id);
    }

    const { pdfUrl } = await req.json() as OCRRequest;

    if (!pdfUrl) {
      return deny(400, 'PDF URL is required');
    }

    // ---- 3. SSRF guard: allowlist + DNS + manual redirects + caps ----
    const allowedHosts = ['res.cloudinary.com', ...extraHosts()];
    let current: URL;
    {
      const v = validateFetchUrl(pdfUrl, { allowedHosts });
      if (!v.ok) {
        console.warn('[process-pdf] rejected url:', user.id);
        return deny(403, 'URL not allowed');
      }
      current = v.url;
    }
    if (!(await hostResolvesPublic(current.hostname))) {
      console.warn('[process-pdf] rejected dns:', user.id);
      return deny(403, 'URL not allowed');
    }

    let pdfResponse: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status >= 300 && res.status < 400) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        const next = resolveRedirectTarget(res.headers.get('location'), current);
        if (!next || hop === MAX_REDIRECTS) {
          console.warn('[process-pdf] rejected redirect:', user.id);
          return deny(403, 'URL not allowed');
        }
        const v = validateFetchUrl(next, { allowedHosts });
        if (!v.ok) {
          console.warn('[process-pdf] rejected redirect target:', user.id);
          return deny(403, 'URL not allowed');
        }
        current = v.url;
        if (!(await hostResolvesPublic(current.hostname))) {
          console.warn('[process-pdf] rejected redirect dns:', user.id);
          return deny(403, 'URL not allowed');
        }
        continue;
      }
      pdfResponse = res;
      break;
    }
    if (!pdfResponse) return deny(403, 'URL not allowed');

    if (!pdfResponse.ok) {
      console.warn('[process-pdf] upstream fetch failed for user:', user.id);
      return deny(400, 'Could not fetch the PDF');
    }
    const contentType = (pdfResponse.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.startsWith('application/pdf')) {
      try { await pdfResponse.body?.cancel(); } catch { /* ignore */ }
      return deny(400, 'URL must point to a PDF document');
    }
    const declared = Number(pdfResponse.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_PDF_BYTES) {
      try { await pdfResponse.body?.cancel(); } catch { /* ignore */ }
      return deny(400, 'PDF is too large');
    }
    const pdfBuffer = await readCappedBytes(pdfResponse, MAX_PDF_BYTES);
    if (!pdfBuffer) {
      return deny(400, 'PDF is too large');
    }
    const base64Pdf = bytesToBase64(pdfBuffer);

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' }); // Using 2.0 Flash as 2.5 is not typically in the current SDK model list, adjusting to a stable latest version or preview from docs.

    // AI Prompt for high-quality Arabic OCR and Markdown formatting
    const prompt = `
    أنت خبير في تحويل الملفات الدراسية الجامعية باستخدام أحدث تقنيات Gemini 2.0/2.5 Flash للفهم المتعدد الوسائط (Multimodal Understanding).
    قم باستخراج النص من ملف الـ PDF المرفق وحوله إلى صيغة Markdown احترافية باللغة العربية.
    
    القواعد:
    1. حافظ على الهيكل العام بدقة فائقة (عناوين، قوائم، جداول معقدة، ملاحظات جانبية).
    2. تأكد من أن النص العربي مكتوب بالاتجاه الصحيح من اليمين إلى اليسار (RTL) وبصيغة سليمة.
    3. إذا كان النص الأصلي في الـ PDF يعاني من مشاكل في التشفير (Reversed text/Encoding issues)، استخدم قدراتك المتقدمة في فهم السياق والأنماط البصرية لتصحيحه.
    4. استخرج النصوص من الصور، الرسوم البيانية، والمعادلات الرياضية إن وجدت وقم بصياغتها بشكل Markdown مناسب.
    5. استخدم لغة عربية فصحى، دقيقة، ومهنية تناسب المحتوى الأكاديمي.
    6. لا تضف أي مقدمات أو خاتمة، ابدأ مباشرة بالنص المستخرج بصيغة Markdown.
    `;

    // Generate content using Gemini 2.5 Flash (supports PDF input)
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Pdf,
          mimeType: "application/pdf"
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    return new Response(
      JSON.stringify({
        success: true,
        text: text.trim()
      }),
      {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (_error) {
    // Never reflect internal details to the caller.
    console.error('Error in process-pdf function');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'حدث خطأ في معالجة الملف'
      }),
      {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}

if (import.meta.main) {
  serve(handleProcessPdf);
}
