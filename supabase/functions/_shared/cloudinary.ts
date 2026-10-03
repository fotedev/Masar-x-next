/**
 * Cloudinary helpers for Supabase Edge Functions.
 *
 * Extracted from the delete-avatar / delete-file / upload-avatar pipeline.
 * Callers keep their own response policy: delete-avatar logs a failed
 * destroy and continues, delete-file turns it into a 400 — the helper only
 * returns the outcome.
 */
import { sha1Hex } from "./crypto.ts";

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  uploadPreset?: string;
}

/**
 * Read + validate Cloudinary env credentials. Returns null (after logging)
 * when missing — callers respond with their own "Server configuration error".
 */
export const getCloudinaryCredentials = (
  requirePreset = false,
): CloudinaryCredentials | null => {
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  const uploadPreset = requirePreset
    ? Deno.env.get("CLOUDINARY_UPLOAD_PRESET")
    : undefined;

  if (!cloudName || !apiKey || !apiSecret || (requirePreset && !uploadPreset)) {
    console.error("Missing Cloudinary credentials");
    return null;
  }
  return { cloudName, apiKey, apiSecret, uploadPreset };
};

/** Signed-params triple used by the Cloudinary Admin API (SHA-1). */
export const signCloudinaryParams = (
  publicId: string,
  apiSecret: string,
): Promise<{ timestamp: number; signature: string }> => {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = sha1Hex(
    `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`,
  );
  return signature.then((signature) => ({ timestamp, signature }));
};

/**
 * Destroy a Cloudinary asset. Parses the response body on both paths (the
 * originals only parsed it on failure — the extra parse has no external
 * effect). `resourceType` defaults to "image".
 */
export const destroyCloudinaryAsset = async (
  creds: CloudinaryCredentials,
  publicId: string,
  resourceType = "image",
): Promise<{ httpOk: boolean; result: unknown }> => {
  const { timestamp, signature } = await signCloudinaryParams(
    publicId,
    creds.apiSecret,
  );

  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("signature", signature);
  formData.append("api_key", creds.apiKey);
  formData.append("timestamp", timestamp.toString());
  formData.append("resource_type", resourceType);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${creds.cloudName}/${resourceType}/destroy`,
    {
      method: "POST",
      body: formData,
    },
  );

  const result = await response.json();
  return { httpOk: response.ok, result };
};
