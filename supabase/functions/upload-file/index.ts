// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCorsHeaders } from '../_shared/cors.ts'

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
        return new Response('ok', { headers: buildCorsHeaders(req) })
    }

    try {
        // Get authenticated user safely
        const authHeader = req.headers.get('Authorization')
        let user = null
        let userId = ''

        if (authHeader && authHeader.startsWith('Bearer ')) {
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
            const { data: { user: authUser } } = await supabaseClient.auth.getUser(token)

            if (authUser) {
                user = authUser
                userId = authUser.id
            }
        }

        if (!user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                {
                    status: 401,
                    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
                }
            )
        }

        console.log(`📤 Upload request from: ${userId}`)

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
                    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
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
                    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
                }
            )
        }

        const allowedContentTypes = new Set([
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/webp',
            'image/gif',
            'image/avif',
            'image/tiff',
            'image/bmp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'application/zip',
            'application/x-zip-compressed'
        ])
        if (!allowedContentTypes.has(contentType)) {
            return new Response(
                JSON.stringify({ error: 'Unsupported file type' }),
                {
                    status: 400,
                    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
                }
            )
        }

        // Validate file size (base64 is ~33% larger than original)
        const estimatedFileSize = (file.length * 0.75) // Rough estimation
        if (estimatedFileSize > 50 * 1024 * 1024) { // 50MB limit
            return new Response(
                JSON.stringify({ error: 'File too large. Maximum size is 50MB.' }),
                {
                    status: 400,
                    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
                }
            )
        }

        // Get Cloudinary credentials from environment
        const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
        const uploadPreset = Deno.env.get('CLOUDINARY_UPLOAD_PRESET')

        if (!cloudName || !uploadPreset) {
            console.error('❌ Missing Cloudinary credentials:', {
                cloudName: !!cloudName,
                uploadPreset: !!uploadPreset
            })
            return new Response(
                JSON.stringify({
                    error: 'Server configuration error: Missing Cloudinary credentials',
                    details: 'Please check that all Cloudinary environment variables are set in Supabase Edge Functions',
                    debug: {
                        cloudName: !!cloudName,
                        uploadPreset: !!uploadPreset
                    }
                }),
                {
                    status: 500,
                    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
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
        // Use a unique public_id to avoid collisions
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
        formData.append('public_id', `${userId}_${Date.now()}_${sanitizedFileName}`)

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
                    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
                }
            )
        }

        if (!cloudinaryResponse.ok) {
            let errorData: unknown
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

            const errorDataObj = (typeof errorData === 'object' && errorData !== null)
                ? (errorData as Record<string, unknown>)
                : null
            const nestedError = (errorDataObj && typeof errorDataObj.error === 'object' && errorDataObj.error !== null)
                ? (errorDataObj.error as Record<string, unknown>)
                : null
            const errorMessage =
                (errorDataObj && typeof errorDataObj.message === 'string' && errorDataObj.message.trim() !== ''
                    ? errorDataObj.message
                    : (nestedError && typeof nestedError.message === 'string' && nestedError.message.trim() !== ''
                        ? nestedError.message
                        : 'Unknown error'))

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
                    message: errorMessage
                }),
                {
                    status: 500,
                    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
                }
            )
        }

        let cloudinaryData: unknown
        try {
            cloudinaryData = await cloudinaryResponse.json()
        } catch (parseError) {
            console.error('Failed to parse Cloudinary success response:', parseError)
            return new Response(
                JSON.stringify({ error: 'Upload succeeded but failed to parse response' }),
                {
                    status: 500,
                    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
                }
            )
        }

        const cloudinaryObj = (typeof cloudinaryData === 'object' && cloudinaryData !== null)
            ? (cloudinaryData as Record<string, unknown>)
            : null
        const secureUrl = cloudinaryObj && typeof cloudinaryObj.secure_url === 'string' ? cloudinaryObj.secure_url : ''
        const publicId = cloudinaryObj && typeof cloudinaryObj.public_id === 'string' ? cloudinaryObj.public_id : ''
        const uploadedBytes = cloudinaryObj && typeof cloudinaryObj.bytes === 'number' ? cloudinaryObj.bytes : undefined
        const format = cloudinaryObj && typeof cloudinaryObj.format === 'string' ? cloudinaryObj.format : undefined

        console.log('Upload successful:', {
            url: secureUrl,
            public_id: publicId,
            bytes: uploadedBytes,
            format
        })

        return new Response(
            JSON.stringify({
                success: true,
                url: secureUrl,
                public_id: publicId,
                message: 'File uploaded successfully'
            }),
            {
                status: 200,
                headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
            }
        )

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred'
        const name = error instanceof Error ? error.name : 'Error'
        const stack = error instanceof Error ? error.stack : undefined
        const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined
        console.error('Upload error:', {
            message,
            stack,
            name,
            cause
        })

        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: message,
                timestamp: new Date().toISOString(),
                type: name
            }),
            {
                status: 500,
                headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' }
            }
        )
    }
})