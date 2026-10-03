// @ts-nocheck
import { corsPreflight, jsonResponse } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { getCloudinaryCredentials } from '../_shared/cloudinary.ts';

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
    return corsPreflight(req)
  }

  try {
    // Authenticate the caller (client + user via the shared scaffold)
    const auth = await requireUser(req)
    if (auth.response) return auth.response
    const { user, client: supabaseClient } = auth

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
      return jsonResponse(req, { error: 'Missing required fields: file, fileName, contentType' }, 400)
    }

    // Get Cloudinary credentials from environment
    const creds = getCloudinaryCredentials(true)
    if (!creds) {
      return jsonResponse(req, { error: 'Server configuration error' }, 500)
    }

    // Prepare Cloudinary upload
    const formData = new FormData()
    formData.append('file', `data:${contentType};base64,${file}`)
    formData.append('upload_preset', creds.uploadPreset)
    formData.append('folder', folder)
    formData.append('resource_type', resourceType)
    formData.append('public_id', `${user.id}_${Date.now()}`)

    // Upload to Cloudinary
    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${creds.cloudName}/${resourceType === 'raw' ? 'raw' : 'image'}/upload`,
      {
        method: 'POST',
        body: formData,
      }
    )

    if (!cloudinaryResponse.ok) {
      const errorData = await cloudinaryResponse.json()
      console.error('Cloudinary upload failed:', errorData)
      return jsonResponse(req, { error: 'Upload failed', details: errorData }, 500)
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

    return jsonResponse(req, {
      success: true,
      url: cloudinaryData.secure_url,
      public_id: cloudinaryData.public_id,
      message: 'File uploaded successfully'
    })

  } catch (error: unknown) {
    console.error('Upload error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse(req, { error: 'Internal server error', details: message }, 500)
  }
})
