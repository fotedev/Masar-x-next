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

  if (session) {
    console.log('✅ Session found for user:', session.user?.email)
  } else {
    console.log('ℹ️ No active session found - proceeding as guest')
  }

  // For guest uploads, use direct fetch to avoid automatic auth header injection
  let uploadPromise: Promise<any>

  if (session?.access_token) {
    // Authenticated upload using Supabase client
    uploadPromise = supabase.functions.invoke('upload-file', {
      body: {
        file: base64,
        fileName: file.name,
        contentType: file.type,
        folder: options.folder || 'masarx-uploads',
        resourceType: options.resourceType || 'auto',
      }
    })
  } else {
    // Guest upload using direct fetch
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    uploadPromise = fetch(`${supabaseUrl}/functions/v1/upload-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey!,
      },
      body: JSON.stringify({
        file: base64,
        fileName: file.name,
        contentType: file.type,
        folder: options.folder || 'masarx-uploads',
        resourceType: options.resourceType || 'auto',
      })
    }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) {
        return { data: null, error: { message: data.error || 'Upload failed' } }
      }
      return { data, error: null }
    })
  }

  // Add timeout for large files (5 minutes)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Upload timeout - file too large or slow connection')), 300000)
  })

  const { data, error } = await Promise.race([uploadPromise, timeoutPromise]) as any

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  if (!data.success) {
    throw new Error(`Upload failed: ${data.error || 'Unknown error'}`)
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
    console.error('Session error:', sessionError)
    throw new Error('فشل في التحقق من حالة تسجيل الدخول')
  }

  if (!session || !session.access_token) {
    console.warn('No active session found')
    throw new Error('يجب تسجيل الدخول أولاً لحذف الملفات')
  }

  console.log('✅ Session found for user:', session.user?.email)

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
 */
export const getCloudinaryUrl = (
  publicId: string,
  transformations: Record<string, any> = {}
): string => {
  const cloudName = 'de3emq8l3'
  const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`

  const transformationString = Object.entries(transformations)
    .map(([key, value]) => `${key}_${value}`)
    .join(',')

  if (transformationString) {
    return `${baseUrl}/${transformationString}/${publicId}`
  }

  return `${baseUrl}/${publicId}`
}