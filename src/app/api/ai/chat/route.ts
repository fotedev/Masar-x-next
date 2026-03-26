import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side AI chat API endpoint
 * Used as fallback when Puter.js is unavailable
 */

type ChatRequest = {
  prompt: string;
  model?: string;
  mode?: 'group_rag' | 'cs_assistant' | 'student_agent';
};

/**
 * Simple fallback response generator
 * Returns helpful guidance when AI service is unavailable
 */
function generateFallbackResponse(prompt: string, mode: string): string {
  const query = prompt.toLowerCase();
  
  if (query.includes('كود') || query.includes('code') || query.includes('برنامج')) {
    return `I understand you're asking about code. Since the AI service is temporarily unavailable, here are some helpful resources:

**English Resources:**
- MDN WebDocs: https://developer.mozilla.org
- Stack Overflow: https://stackoverflow.com
- W3Schools: https://w3schools.com

**عربي:**
- أكاديمية Alison: https://alison.com
- Coursera: https://www.coursera.org
- edX: https://www.edx.org

معذرة، خدمة الذكاء الاصطناعي غير متاحة حالياً. يرجى المحاولة لاحقاً أو استشارة المصادر أعلاه.`;
  }
  
  if (mode === 'cs_assistant') {
    return 'The AI assistant service is temporarily unavailable. Please try again in a few moments. You can also check online programming resources like MDN, Stack Overflow, or GeeksforGeeks.';
  }
  
  return '⚠️ خدمة الذكاء الاصطناعي غير متاحة حالياً. يرجى المحاولة مرة أخرى لاحقاً.\n\n⚠️ AI service is temporarily unavailable. Please try again later.';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ChatRequest;
    
    if (!body.prompt || typeof body.prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid prompt' },
        { status: 400 }
      );
    }

    // Validate request size
    if (body.prompt.length > 10000) {
      return NextResponse.json(
        { error: 'Prompt too long (max 10000 characters)' },
        { status: 400 }
      );
    }

    // For now, return a graceful fallback message
    // In the future, this can be enhanced with actual LLM integration
    // (e.g., Anthropic, OpenAI, or Vercel AI SDK)
    const response = generateFallbackResponse(body.prompt, body.mode || 'group_rag');

    return NextResponse.json(
      { 
        message: response,
        source: 'fallback',
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
