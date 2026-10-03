import { corsPreflight, jsonResponse } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  destroyCloudinaryAsset,
  getCloudinaryCredentials,
} from '../_shared/cloudinary.ts';

interface DeleteRequest {
  publicId: string
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return corsPreflight(req)
  }

  try {
    // Authenticate the caller (client + user via the shared scaffold)
    const auth = await requireUser(req)
    if (auth.response) return auth.response
    const { user, client: supabaseClient } = auth

    const { publicId }: DeleteRequest = await req.json()

    // Validate input
    if (!publicId) {
      return jsonResponse(req, { error: 'Missing publicId parameter' }, 400)
    }

    // Get Cloudinary credentials from environment
    const creds = getCloudinaryCredentials()
    if (!creds) {
      return jsonResponse(req, { error: 'Server configuration error' }, 500)
    }

    // Delete from Cloudinary
    const { httpOk, result } = await destroyCloudinaryAsset(creds, publicId, 'image')

    if (!httpOk) {
      console.error('Cloudinary delete failed:', result)
      // Don't fail if Cloudinary delete fails, just log it
    }

    // Update user profile in database
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Database update failed:', updateError)
      return jsonResponse(req, { error: 'Failed to update profile' }, 500)
    }

    return jsonResponse(req, {
      success: true,
      message: 'Avatar deleted successfully'
    })

  } catch (error) {
    console.error('Delete error:', error)
    return jsonResponse(req, { error: 'Internal server error', details: (error as { message?: unknown }).message }, 500)
  }
})
