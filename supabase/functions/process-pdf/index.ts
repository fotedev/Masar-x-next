// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0"
import { buildCorsHeaders } from '../_shared/cors.ts';

interface OCRRequest {
  pdfUrl: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) })
  }

  try {
    const { pdfUrl } = await req.json() as OCRRequest;

    if (!pdfUrl) {
      throw new Error('PDF URL is required');
    }

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' }); // Using 2.0 Flash as 2.5 is not typically in the current SDK model list, adjusting to a stable latest version or preview from docs.

    // Fetch the PDF content
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF from Cloudinary: ${pdfResponse.statusText}`);
    }
    const pdfBlob = await pdfResponse.blob();
    const pdfBuffer = await pdfBlob.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

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

  } catch (error) {
    console.error('Error in process-pdf function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'حدث خطأ في معالجة الملف'
      }),
      {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
