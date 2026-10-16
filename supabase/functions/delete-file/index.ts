// @ts-nocheck
import { jsonResponse } from '../_shared/http.ts';
import { withAuthedJson } from '../_shared/auth.ts';
import {
  destroyCloudinaryAsset,
  getCloudinaryCredentials,
} from '../_shared/cloudinary.ts';

interface DeleteRequest {
    publicId: string
    resourceType?: 'image' | 'video' | 'raw'
}

Deno.serve((req: Request) =>
    withAuthedJson<DeleteRequest>(req, 'Delete', async ({ user, client: supabaseClient, body }) => {
        const { publicId, resourceType = 'image' }: DeleteRequest = body

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
    })
)
