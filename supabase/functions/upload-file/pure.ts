/**
 * Pure helpers extracted verbatim from index.ts serve() so they can be unit
 * tested offline (see ../_shared/tests/upload-file-pure.test.ts). Behavior is
 * identical to the inline originals — index.ts calls these.
 */

/** 50MB upload limit (the inline literal `50 * 1024 * 1024` in serve()). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** The exact content-type allowlist serve() enforced inline. */
const ALLOWED_CONTENT_TYPES = new Set([
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
  'application/x-zip-compressed',
]);

export const isAllowedContentType = (contentType: string): boolean =>
  ALLOWED_CONTENT_TYPES.has(contentType);

/**
 * Rough decoded size of a base64 payload: base64 is ~33% larger than the
 * original bytes, so `length * 0.75` estimates the real size.
 */
export const estimateBase64Size = (base64: string): number => base64.length * 0.75;

/** True when the estimated decoded size exceeds the 50MB limit. */
export const exceedsMaxUploadSize = (base64: string): boolean =>
  estimateBase64Size(base64) > MAX_UPLOAD_BYTES;

/**
 * public_id-safe filename: everything outside [a-zA-Z0-9._-] becomes '_'.
 */
export const sanitizeFileName = (fileName: string): string =>
  fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

/**
 * Extract the user-facing message from a parsed Cloudinary error payload.
 * Cloudinary sometimes nests the message under `error.message` (upload
 * preset / auth failures) and sometimes tops it at `message`; blank strings
 * are treated as absent and fall through to 'Unknown error'.
 */
export const extractCloudinaryErrorMessage = (errorData: unknown): string => {
  const errorDataObj = (typeof errorData === 'object' && errorData !== null)
    ? (errorData as Record<string, unknown>)
    : null;
  const nestedError =
    (errorDataObj && typeof errorDataObj.error === 'object' && errorDataObj.error !== null)
      ? (errorDataObj.error as Record<string, unknown>)
      : null;
  return (errorDataObj && typeof errorDataObj.message === 'string' && errorDataObj.message.trim() !== ''
    ? errorDataObj.message
    : (nestedError && typeof nestedError.message === 'string' && nestedError.message.trim() !== ''
      ? nestedError.message
      : 'Unknown error'));
};
