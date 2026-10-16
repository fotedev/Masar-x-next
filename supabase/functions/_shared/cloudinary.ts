/**
 * Cloudinary helpers for Supabase Edge Functions.
 *
 * Extracted from the delete-file / upload-avatar pipeline (delete-avatar
 * now resolves ownership through its handler split and no longer calls
 * into this module). Callers keep their own response policy: delete-file
 * turns a failed destroy into a 400 — the helper only returns the outcome.
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
  const entries: Array<
    { key: "cloudName" | "apiKey" | "apiSecret" | "uploadPreset"; value: string | undefined; required: boolean }
  > = [
    { key: "cloudName", value: Deno.env.get("CLOUDINARY_CLOUD_NAME"), required: true },
    { key: "apiKey", value: Deno.env.get("CLOUDINARY_API_KEY"), required: true },
    { key: "apiSecret", value: Deno.env.get("CLOUDINARY_API_SECRET"), required: true },
    { key: "uploadPreset", value: Deno.env.get("CLOUDINARY_UPLOAD_PRESET"), required: requirePreset },
  ];
  const creds = {} as CloudinaryCredentials;
  for (const { key, value, required } of entries) {
    if (!value) {
      if (!required) continue;
      console.error("Missing Cloudinary credentials");
      return null;
    }
    creds[key] = value;
  }
  return creds;
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
  // Signed-params triple for the Cloudinary Admin API (SHA-1).
  const timestamp = Math.round(Date.now() / 1000);
  const signature = await sha1Hex(
    `public_id=${publicId}&timestamp=${timestamp}${creds.apiSecret}`,
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
