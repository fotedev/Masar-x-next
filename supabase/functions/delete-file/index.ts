// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface DeleteRequest {
    publicId: string
    resourceType?: 'image' | 'video' | 'raw'
}

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
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
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        const { publicId, resourceType = 'image' }: DeleteRequest = await req.json()

        // Validate input
        if (!publicId) {
            return new Response(
                JSON.stringify({ error: 'Missing publicId parameter' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Enforce ownership: publicId must start with user id prefix
        if (!publicId.startsWith(`${user.id}_`)) {
            return new Response(
                JSON.stringify({ error: 'Forbidden' }),
                {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
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
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
        formData.append('resource_type', resourceType)

        const cloudinaryResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
            {
                method: 'POST',
                body: formData,
            }
        )

        const result = await cloudinaryResponse.json()

        if (!cloudinaryResponse.ok || result.result !== 'ok') {
            console.error('Cloudinary delete failed:', result)
            return new Response(
                JSON.stringify({
                    success: false,
                    error: result.error?.message || 'Cloudinary deletion failed',
                    details: result
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'File deleted successfully'
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error: any) {
        console.error('Delete error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
