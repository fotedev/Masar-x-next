// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface UploadRequest {
    file: string // base64 encoded file
    fileName: string
    contentType: string
    folder?: string
    resourceType?: 'image' | 'video' | 'raw' | 'auto'
}

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Get authenticated user safely
        const authHeader = req.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }),
                {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Get Supabase client with user's authorization
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        )

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

        // Parse and validate request body
        let requestBody: UploadRequest
        try {
            requestBody = await req.json()
        } catch (error) {
            console.error('Invalid JSON in request body:', error)
            return new Response(
                JSON.stringify({ error: 'Invalid JSON in request body' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        const {
            file,
            fileName,
            contentType,
            folder = 'masarx-uploads',
            resourceType = 'auto',
        } = requestBody

        // Validate required fields
        if (!file || !fileName || !contentType) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: file, fileName, contentType' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Validate file size (base64 is ~33% larger than original)
        const estimatedFileSize = (file.length * 0.75) // Rough estimation
        if (estimatedFileSize > 10 * 1024 * 1024) { // 10MB limit
            return new Response(
                JSON.stringify({ error: 'File too large. Maximum size is 10MB.' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Get Cloudinary credentials from environment
        const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
        const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
        const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')
        const uploadPreset = Deno.env.get('CLOUDINARY_UPLOAD_PRESET')

        console.log('🔍 Cloudinary config check:', {
            cloudName: cloudName ? '✅ Set' : '❌ Missing',
            apiKey: apiKey ? '✅ Set' : '❌ Missing',
            apiSecret: apiSecret ? '✅ Set' : '❌ Missing',
            uploadPreset: uploadPreset ? '✅ Set' : '❌ Missing'
        })

        // Log all environment variables for debugging
        console.log('🔧 Environment variables status:', {
            'CLOUDINARY_CLOUD_NAME': Deno.env.get('CLOUDINARY_CLOUD_NAME') ? 'Set' : 'NOT SET',
            'CLOUDINARY_API_KEY': Deno.env.get('CLOUDINARY_API_KEY') ? 'Set' : 'NOT SET',
            'CLOUDINARY_API_SECRET': Deno.env.get('CLOUDINARY_API_SECRET') ? 'Set' : 'NOT SET',
            'CLOUDINARY_UPLOAD_PRESET': Deno.env.get('CLOUDINARY_UPLOAD_PRESET') ? 'Set' : 'NOT SET',
            'SUPABASE_URL': Deno.env.get('SUPABASE_URL') ? 'Set' : 'NOT SET',
            'SUPABASE_ANON_KEY': Deno.env.get('SUPABASE_ANON_KEY') ? 'Set' : 'NOT SET'
        })

        if (!cloudName || !apiKey || !apiSecret || !uploadPreset) {
            console.error('❌ Missing Cloudinary credentials:', {
                cloudName: !!cloudName,
                apiKey: !!apiKey,
                apiSecret: !!apiSecret,
                uploadPreset: !!uploadPreset
            })
            return new Response(
                JSON.stringify({
                    error: 'Server configuration error: Missing Cloudinary credentials',
                    details: 'Please check that all Cloudinary environment variables are set in Supabase Edge Functions',
                    debug: {
                        cloudName: !!cloudName,
                        apiKey: !!apiKey,
                        apiSecret: !!apiSecret,
                        uploadPreset: !!uploadPreset
                    }
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Convert base64 to Blob for Cloudinary upload
        const base64Data = file
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: contentType })

        // Prepare Cloudinary upload
        const formData = new FormData()
        formData.append('file', blob, fileName)
        formData.append('upload_preset', uploadPreset)
        formData.append('folder', folder)
        formData.append('resource_type', resourceType)
        // Make files publicly accessible
        formData.append('access_mode', 'public')
        formData.append('type', 'upload')
        // Use a unique public_id to avoid collisions
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
        formData.append('public_id', `${user.id}_${Date.now()}_${sanitizedFileName}`)

        console.log('Uploading to Cloudinary:', {
            folder,
            resourceType,
            fileName: sanitizedFileName,
            contentType,
            estimatedSize: `${(estimatedFileSize / 1024 / 1024).toFixed(2)}MB`
        })

        // Upload to Cloudinary with timeout
        let cloudinaryResponse: Response
        try {
            const uploadPromise = fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
                {
                    method: 'POST',
                    body: formData,
                }
            )

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Cloudinary upload timeout')), 30000) // 30 second timeout
            )

            cloudinaryResponse = await Promise.race([uploadPromise, timeoutPromise])
        } catch (error) {
            console.error('Cloudinary upload error:', error)
            return new Response(
                JSON.stringify({ error: 'Upload failed: Network or timeout error' }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        if (!cloudinaryResponse.ok) {
            let errorData: any
            let errorText: string = ''
            try {
                errorText = await cloudinaryResponse.text()
                try {
                    errorData = JSON.parse(errorText)
                } catch {
                    errorData = { message: errorText || 'Unknown Cloudinary error' }
                }
            } catch (parseError) {
                console.error('Failed to parse Cloudinary error response:', parseError)
                errorData = { message: 'Failed to parse error response' }
            }

            console.error('Cloudinary upload failed:', {
                status: cloudinaryResponse.status,
                statusText: cloudinaryResponse.statusText,
                error: errorData,
                rawResponse: errorText.substring(0, 500) // First 500 chars for debugging
            })

            return new Response(
                JSON.stringify({
                    error: 'Upload failed',
                    details: errorData,
                    status: cloudinaryResponse.status,
                    message: errorData.message || errorData.error?.message || 'Unknown error'
                }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        let cloudinaryData: any
        try {
            cloudinaryData = await cloudinaryResponse.json()
        } catch (parseError) {
            console.error('Failed to parse Cloudinary success response:', parseError)
            return new Response(
                JSON.stringify({ error: 'Upload succeeded but failed to parse response' }),
                {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        console.log('Upload successful:', {
            url: cloudinaryData.secure_url,
            public_id: cloudinaryData.public_id,
            bytes: cloudinaryData.bytes,
            format: cloudinaryData.format
        })

        return new Response(
            JSON.stringify({
                success: true,
                url: cloudinaryData.secure_url,
                public_id: cloudinaryData.public_id,
                message: 'File uploaded successfully'
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )

    } catch (error: any) {
        console.error('Upload error:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            cause: error.cause
        })

        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: error.message || 'An unexpected error occurred',
                timestamp: new Date().toISOString(),
                type: error.name || 'Error'
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})