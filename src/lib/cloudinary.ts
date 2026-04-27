import { supabase } from './supabase'

/**
 * Cloudinary utility functions using Supabase Edge Functions
 * Updated to use shared Supabase client to prevent multiple GoTrueClient instances
 * Now supports guest uploads with optional authentication
 */

export interface CloudinaryUploadOptions {
  folder?: string
  resourceType?: 'image' | 'video' | 'raw' | 'auto'
  skipProfileUpdate?: boolean
  onProgress?: (progress: number, stage: string) => void
}

export interface CloudinaryUploadResult {
  success: boolean
  url: string
  public_id: string
  message: string
}

type UploadError = {
  message: string
  details?: unknown
}

const isUploadResult = (value: unknown): value is CloudinaryUploadResult => {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.success === 'boolean' &&
    typeof v.url === 'string' &&
    typeof v.public_id === 'string' &&
    typeof v.message === 'string'
  )
}

/**
 * Upload a file to Cloudinary via Supabase Edge Function
 * Supports both authenticated users and guests
 */
export const uploadToCloudinary = async (
  file: File,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryUploadResult> => {
  const { onProgress } = options

  // Update progress: Starting conversion
  onProgress?.(0, 'تحويل الملف...')

  // Convert file to base64 with progress tracking
  const base64 = await fileToBase64(file, (progress) => {
    onProgress?.(progress * 0.3, 'تحويل الملف...') // 30% of total progress for conversion
  })

  // Update progress: Conversion complete, starting upload
  onProgress?.(30, 'جاري رفع الملف...')

  // Get current session - make it optional for guest uploads
  const { data: { session } } = await supabase.auth.getSession()

  // Allow guest uploads if no session/access token is present.
  const accessToken = session?.access_token || null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const body = {
    file: base64,
    fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
    contentType: file.type,
    folder: options.folder || 'masarx-uploads',
    resourceType: options.resourceType || 'auto',
  }

  const { data, error } = await new Promise<{ data: unknown; error: UploadError | null }>((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${supabaseUrl}/functions/v1/upload-file`)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.setRequestHeader('apikey', anonKey)
    // If the user is authenticated, include Authorization header. Guests will rely on the anon key.
    if (accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    }
    xhr.timeout = 300000

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress?.(50, 'جاري رفع الملف...')
        return
      }

      const rawPct = (event.loaded / event.total) * 100
      const overallPct = 30 + (rawPct * 0.7)
      onProgress?.(Math.min(99, overallPct), 'جاري رفع الملف...')
    }

    xhr.onload = () => {
      const text = xhr.responseText || ''
      let parsed: unknown = null
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        parsed = { error: text || 'Invalid JSON response' }
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        resolve({
          data: null,
          error: {
            message:
              typeof parsed === 'object' && parsed !== null
                ? String((parsed as Record<string, unknown>).message || (parsed as Record<string, unknown>).error || `Upload failed (${xhr.status})`)
                : `Upload failed (${xhr.status})`,
            details: parsed,
          },
        })
        return
      }

      resolve({ data: parsed, error: null })
    }

    xhr.onerror = () => {
      resolve({ data: null, error: { message: 'Upload failed: Network error' } })
    }

    xhr.ontimeout = () => {
      resolve({ data: null, error: { message: 'Upload timeout - file too large or slow connection' } })
    }

    xhr.send(JSON.stringify(body))
  })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  if (!isUploadResult(data)) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as Record<string, unknown>).error)
        : 'Unknown error'
    throw new Error(`Upload failed: ${errMsg}`)
  }

  // Update progress: Complete
  onProgress?.(100, 'تم الرفع بنجاح')

  return data
}

/**
 * Convert File to base64 string with progress tracking
 */
const fileToBase64 = (file: File, onProgress?: (progress: number) => void): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    // Track progress for large files
    if (onProgress && file.size > 1024 * 1024) { // > 1MB
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          onProgress(progress)
        }
      }
    }

    reader.onload = () => {
      const base64 = reader.result as string
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = error => reject(error)

    reader.readAsDataURL(file)
  })
}

/**
 * Delete a file from Cloudinary via Supabase Edge Function
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  // Get current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    throw new Error('فشل في التحقق من حالة تسجيل الدخول')
  }

  if (!session || !session.access_token) {
    throw new Error('يجب تسجيل الدخول أولاً لحذف الملفات')
  }

  // Call Edge Function for secure deletion
  const { error } = await supabase.functions.invoke('delete-file', {
    body: { publicId }
  })

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}

/**
 * Generate Cloudinary URL with transformations
 * Uses NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME from environment variables
 */
export const getCloudinaryUrl = (
  publicId: string,
  transformations: Record<string, string | number> = {}
): string => {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error('Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME environment variable');
  }
  const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`

  const transformationString = Object.entries(transformations)
    .map(([key, value]) => `${key}_${value}`)
    .join(',')

  if (transformationString) {
    return `${baseUrl}/${transformationString}/${publicId}`
  }

  return `${baseUrl}/${publicId}`
}