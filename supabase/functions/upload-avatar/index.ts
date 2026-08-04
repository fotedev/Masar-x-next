// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCorsHeaders } from '../_shared/cors.ts';

interface UploadRequest {
  file: string // base64 encoded file
  fileName: string
  contentType: string
  folder?: string
  resourceType?: 'image' | 'video' | 'raw' | 'auto'
  skipProfileUpdate?: boolean
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) })
  }

  try {
    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      )
    }

    const {
      file,
      fileName,
      contentType,
      folder = 'avatars',
      resourceType = 'auto',
      skipProfileUpdate = false
    }: UploadRequest = await req.json()

    // Validate input
    if (!file || !fileName || !contentType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: file, fileName, contentType' }),
        {
          status: 400,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Cloudinary credentials from environment
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')
    const uploadPreset = Deno.env.get('CLOUDINARY_UPLOAD_PRESET')

    if (!cloudName || !apiKey || !apiSecret || !uploadPreset) {
      console.error('Missing Cloudinary credentials')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepare Cloudinary upload
    const formData = new FormData()
    formData.append('file', `data:${contentType};base64,${file}`)
    formData.append('upload_preset', uploadPreset)
    formData.append('folder', folder)
    formData.append('resource_type', resourceType)
    formData.append('public_id', `${user.id}_${Date.now()}`)

    // Upload to Cloudinary
    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType === 'raw' ? 'raw' : 'image'}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    )

    if (!cloudinaryResponse.ok) {
      const errorData = await cloudinaryResponse.json()
      console.error('Cloudinary upload failed:', errorData)
      return new Response(
        JSON.stringify({ error: 'Upload failed', details: errorData }),
        {
          status: 500,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      )
    }

    const cloudinaryData = await cloudinaryResponse.json()

    // Update user profile in database if not skipped
    if (!skipProfileUpdate) {
      console.log('Updating profile for user:', user.id)
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          avatar_url: cloudinaryData.secure_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Database update failed:', updateError)
        // Try upsert as fallback if update failed (though profile should exist)
        const { error: upsertError } = await supabaseClient
          .from('profiles')
          .upsert({
            id: user.id,
            avatar_url: cloudinaryData.secure_url,
            updated_at: new Date().toISOString()
          })
        if (upsertError) console.error('Database upsert also failed:', upsertError)
      } else {
        console.log('Profile updated successfully with URL:', cloudinaryData.secure_url)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: cloudinaryData.secure_url,
        public_id: cloudinaryData.public_id,
        message: 'File uploaded successfully'
      }),
      {
        status: 200,
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    )

  } catch (error: unknown) {
    console.error('Upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      {
        status: 500,
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    )
  }
})