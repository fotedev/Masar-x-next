// @ts-nocheck
import { corsPreflight, jsonResponse } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import {
  destroyCloudinaryAsset,
  getCloudinaryCredentials,
} from '../_shared/cloudinary.ts';

interface DeleteRequest {
    publicId: string
    resourceType?: 'image' | 'video' | 'raw'
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

        const { publicId, resourceType = 'image' }: DeleteRequest = await req.json()

        // Validate input
        if (!publicId) {
            return jsonResponse(req, { error: 'Missing publicId parameter' }, 400)
        }

        // Enforce ownership: publicId must start with user id prefix
        if (!publicId.startsWith(`${user.id}_`)) {
            return jsonResponse(req, { error: 'Forbidden' }, 403)
        }

        // Get Cloudinary credentials from environment
        const creds = getCloudinaryCredentials()
        if (!creds) {
            return jsonResponse(req, { error: 'Server configuration error' }, 500)
        }

        // Delete from Cloudinary
        const { httpOk, result } = await destroyCloudinaryAsset(creds, publicId, resourceType)

        if (!httpOk || result.result !== 'ok') {
            console.error('Cloudinary delete failed:', result)
            return jsonResponse(req, {
                success: false,
                error: result.error?.message || 'Cloudinary deletion failed',
                details: result
            }, 400)
        }

        return jsonResponse(req, {
            success: true,
            message: 'File deleted successfully'
        })

    } catch (error: unknown) {
        console.error('Delete error:', error)
        const message = error instanceof Error ? error.message : 'Unknown error'
        return jsonResponse(req, { error: 'Internal server error', details: message }, 500)
    }
})
