// @ts-nocheck: Deno runtime types
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.24.1"
import { buildCorsHeaders } from '../_shared/cors.ts';

interface ImportantMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  created_at: string;
  context: string;
}

type AiImportantMessage = {
  content?: string;
  sender_name?: string;
  context?: string;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user from the request
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    const { chatId } = await req.json()

    if (!chatId) {
      throw new Error('Chat ID is required')
    }

    // Verify user has access to this chat
    const { data: chatParticipant, error: participantError } = await supabaseClient
      .from('chat_participants')
      .select('chat_id')
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
      .single()

    if (participantError || !chatParticipant) {
      throw new Error('Access denied: User is not a participant in this chat')
    }

    // Get recent messages for summarization (last 50 messages)
    const { data: messages, error: messagesError } = await supabaseClient
      .from('messages')
      .select(`
        id,
        content,
        sender_id,
        created_at,
        sender:auth.users!messages_sender_id_fkey(id, email, raw_user_meta_data)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (messagesError) {
      throw messagesError
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No messages to summarize' }),
        {
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Reverse messages to chronological order
    const chronologicalMessages = messages.reverse()

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '')
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

    // Prepare conversation text for AI analysis
    const conversationText = chronologicalMessages
      .map(msg => {
        const senderName = msg.sender?.raw_user_meta_data?.display_name ||
          msg.sender?.raw_user_meta_data?.name ||
          msg.sender?.email?.split('@')[0] ||
          'مستخدم'
        return `${senderName}: ${msg.content}`
      })
      .join('\n')

    // AI Prompt for summarization and important message detection
    const prompt = `
    قم بتحليل المحادثة التالية وأعد:

    1. ملخصاً موجزاً للمحادثة باللغة العربية (لا يتجاوز 200 كلمة)
    2. تحديد الرسائل المهمة مع السياق الكامل لكل رسالة مهمة

    المحادثة:
    ${conversationText}

    يرجى تقديم النتيجة بتنسيق JSON بالشكل التالي:
    {
      "summary": "الملخص هنا",
      "important_messages": [
        {
          "id": "message_id",
          "content": "محتوى الرسالة",
          "sender_name": "اسم المرسل",
          "context": "السياق المحيط بالرسالة المهمة"
        }
      ]
    }

    معايير تحديد الرسائل المهمة:
    - الرسائل التي تحتوي على قرارات أو اتفاقيات
    - الرسائل التي تحتوي على معلومات مهمة أو حقائق
    - الرسائل التي تحتوي على طلبات أو وعود
    - الرسائل التي تحتوي على أسئلة مهمة أو إجابات حاسمة
    - الرسائل التي تظهر تغييراً في الرأي أو التوجه
    `

    // Generate AI response
    const result = await model.generateContent(prompt)
    const response = await result.response
    const aiResponseText = response.text()

    // Parse AI response
    let aiAnalysis
    try {
      // Extract JSON from the response (AI might add extra text)
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        aiAnalysis = JSON.parse(jsonMatch[0])
      } else {
        aiAnalysis = JSON.parse(aiResponseText)
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError)
      // Fallback analysis
      aiAnalysis = {
        summary: 'تم تحليل المحادثة بواسطة الذكاء الاصطناعي',
        important_messages: []
      }
    }

    // Prepare important messages with full context
    const importantMessages: ImportantMessage[] = aiAnalysis.important_messages?.map((msg: unknown) => {
      const msgObj = (typeof msg === 'object' && msg !== null)
        ? (msg as AiImportantMessage)
        : null
      if (!msgObj || typeof msgObj.content !== 'string' || typeof msgObj.sender_name !== 'string') {
        return null
      }
      // Find the original message to get full details
      const originalMessage = chronologicalMessages.find(m => {
        const senderName = m.sender?.raw_user_meta_data?.display_name ||
          m.sender?.raw_user_meta_data?.name ||
          m.sender?.email?.split('@')[0] ||
          'مستخدم'
        return m.content === msgObj.content && senderName === msgObj.sender_name
      })

      if (originalMessage) {
        return {
          id: originalMessage.id,
          content: originalMessage.content,
          sender_id: originalMessage.sender_id,
          sender_name: msgObj.sender_name,
          created_at: originalMessage.created_at,
          context: (typeof msgObj.context === 'string' && msgObj.context.trim() !== '' ? msgObj.context : originalMessage.content)
        }
      }

      return null
    }).filter(Boolean) || []

    // Get the last processed message ID
    const lastMessageId = chronologicalMessages[chronologicalMessages.length - 1]?.id

    // Save AI summary to database
    const { error: summaryError } = await supabaseClient
      .from('ai_summaries')
      .insert({
        chat_id: chatId,
        summary_content: aiAnalysis.summary,
        important_messages: importantMessages,
        last_message_id: lastMessageId,
      })

    if (summaryError) {
      throw summaryError
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: aiAnalysis.summary,
        important_messages_count: importantMessages.length,
        message: 'تم إنشاء ملخص الذكاء الاصطناعي بنجاح'
      }),
      {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in summarize-chat function:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'حدث خطأ في معالجة الطلب',
        success: false
      }),
      {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
