import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCorsHeaders } from '../_shared/cors.ts';
import { getBearerToken } from '../_shared/auth.ts';
import {
  extractCloudinaryPublicId,
  isOwnedAvatarPublicId,
} from '../_shared/avatar-id.ts';

// P0 hotfix: the Cloudinary public_id is NEVER taken from the request body.
// It is derived from the caller's own profile record (profiles.avatar_url,
// written by upload-avatar as `avatars/<user.id>_<timestamp>`) and must lie
// inside the caller's own namespace. verify_jwt alone is not sufficient
// (the anon key is itself a valid JWT), so auth.getUser() must resolve a
// real user below.

// Exported for handler-level tests (see ../_shared/tests/handler-delete-avatar.test.ts,
// run with --allow-env --import-map to stub the remote supabase-js import).
// Production entry is index.ts (thin: imports this handler and serves it).
export async function handleDeleteAvatar(req: Request): Promise<Response> {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) })
  }

  const deny = (status: 401 | 403 | 404, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
    });

  try {
    // Get Supabase client (user-scoped: forwards the caller's JWT)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    )

    // Authenticate: resolve the bearer token to a real user.
    const token = getBearerToken(req);
    if (!token) {
      return deny(401, 'Unauthorized');
    }
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      return deny(401, 'Unauthorized');
    }

    // Derive the deletable asset from the caller's OWN profile record.
    // Any `publicId` sent in the request body is intentionally ignored.
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Delete-avatar profile lookup failed for user:', user.id);
      return deny(404, 'No avatar on record');
    }

    const avatarUrl = (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null;
    if (!avatarUrl) {
      return deny(404, 'No avatar on record');
    }

    const publicId = extractCloudinaryPublicId(avatarUrl);
    if (!publicId || !isOwnedAvatarPublicId(publicId, user.id)) {
      console.warn('Delete-avatar refused: stored avatar outside caller namespace for user:', user.id);
      return deny(403, 'Forbidden');
    }

    // Get Cloudinary credentials from environment
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('Missing Cloudinary credentials')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      )
    }

    // Create signature for Cloudinary API
    const timestamp = Math.round(Date.now() / 1000)
    const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
    const signature = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(signatureString))
    const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')

    // Delete from Cloudinary
    const formData = new FormData()
    formData.append('public_id', publicId)
    formData.append('signature', signatureHex)
    formData.append('api_key', apiKey)
    formData.append('timestamp', timestamp.toString())

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      {
        method: 'POST',
        body: formData,
      }
    )

    if (!cloudinaryResponse.ok) {
      console.error('Cloudinary delete failed for user:', user.id)
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
      console.error('Delete-avatar database update failed for user:', user.id)
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        {
          status: 500,
          headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Avatar deleted successfully'
      }),
      {
        status: 200,
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    )

  } catch (_error) {
    // Never reflect internal details to the caller.
    console.error('Delete-avatar internal error');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    )
  }
}
