-- Add analytics and assistant_messages tables for tracking user interactions and AI conversations
-- This enables admin statistics dashboard and conversation logging

-- Create analytics table for tracking user interactions with content
CREATE TABLE public.analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL, -- 'summary_view', 'summary_click', 'ai_interaction'
  content_type TEXT NOT NULL, -- 'summary', 'exam_info', 'course_info', 'ai_response'
  content_id TEXT, -- ID of the content item (e.g., summary ID, exam ID)
  metadata JSONB DEFAULT '{}', -- Additional data (e.g., exam_date, query_text, response_time)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster analytics queries
CREATE INDEX idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX idx_analytics_action_type ON public.analytics(action_type);
CREATE INDEX idx_analytics_content_type ON public.analytics(content_type);
CREATE INDEX idx_analytics_created_at ON public.analytics(created_at);

-- RLS Policy for analytics: Authenticated users can insert their own analytics data
CREATE POLICY "analytics_insert_for_authenticated"
ON public.analytics
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create assistant_messages table for logging AI conversations
CREATE TABLE public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT, -- To group related messages in a conversation
  user_message TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  response_time_ms INTEGER,
  ai_model_used TEXT, -- 'gemini', 'fallback', 'error'
  metadata JSONB DEFAULT '{}', -- e.g., { relevant_chunks_count: 5, api_key_present: true }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster assistant_messages queries
CREATE INDEX idx_assistant_messages_user_id ON public.assistant_messages(user_id);
CREATE INDEX idx_assistant_messages_session_id ON public.assistant_messages(session_id);
CREATE INDEX idx_assistant_messages_created_at ON public.assistant_messages(created_at);

-- RLS Policy for assistant_messages: Authenticated users can insert their own messages
CREATE POLICY "assistant_messages_insert_for_authenticated"
ON public.assistant_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create content_analytics table for aggregated statistics (admin view only)
CREATE TABLE public.content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL, -- 'exam', 'course', 'summary'
  content_id TEXT NOT NULL,
  views_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  unique_views_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(content_type, content_id)
);

-- Create indexes for content_analytics
CREATE INDEX idx_content_analytics_content_type ON public.content_analytics(content_type);
CREATE INDEX idx_content_analytics_content_id ON public.content_analytics(content_id);

-- RLS Policy for content_analytics: Admin only access
CREATE POLICY "content_analytics_admin_only"
ON public.content_analytics
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' = 'admin'
  )
);
