/**
 * PDF upload (spec FR-009): pick a PDF from device storage with
 * expo-document-picker and upload it through the SAME backend path the
 * web app uses for summary PDFs:
 *
 *   - bucket: "summaries-pdfs" (apps/web/src/hooks/useEditSummary.ts)
 *   - path scheme: `summaries/${timestamp}_${sanitizedName}`
 *   - size limit: 50MB - identical to the web's upload-file Edge
 *     Function guard ("File too large. Maximum size is 50MB."), which
 *     is the product-wide upload ceiling (spec: "same size limits").
 *   - auth: requires an authenticated session (same as web).
 *
 * Progress: supabase-js on React Native has no XHR upload-progress
 * events, so we surface honest stage-based progress
 * (read -> upload -> link) rather than fake byte percentages.
 */
import * as DocumentPicker from "expo-document-picker";
import type { SupabaseClient } from "masarx-shared/supabase";

/** Same ceiling the web enforces in supabase/functions/upload-file. */
export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;

/** Same Supabase Storage bucket the web app uploads summary PDFs into. */
export const SUMMARIES_PDF_BUCKET = "summaries-pdfs";

export interface PickedPdf {
  uri: string;
  name: string;
  sizeBytes: number | null;
}

export type UploadStage = "picking" | "reading" | "uploading" | "finalizing" | "done";

export interface UploadProgress {
  stage: UploadStage;
  /** 0..100; stage-accurate but not byte-accurate (see header note). */
  percent: number;
}

export class UploadError extends Error {
  constructor(
    message: string,
    readonly code:
      | "cancelled"
      | "not-pdf"
      | "too-large"
      | "unauthenticated"
      | "upload-failed",
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** Open the OS document picker, restricted to PDFs (FR-009). */
export async function pickPdf(): Promise<PickedPdf> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    throw new UploadError("No file picked", "cancelled");
  }

  const asset = result.assets[0];
  const name = asset.name ?? "document.pdf";
  const mime = asset.mimeType ?? "";
  const looksPdf = mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  if (!looksPdf) {
    throw new UploadError("Selected file is not a PDF", "not-pdf");
  }

  return {
    uri: asset.uri,
    name,
    sizeBytes: typeof asset.size === "number" ? asset.size : null,
  };
}

export async function uploadSummaryPdf(
  supabase: SupabaseClient,
  pdf: PickedPdf,
  onProgress?: (progress: UploadProgress) => void,
): Promise<{ path: string; publicUrl: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new UploadError("Sign in before uploading", "unauthenticated");
  }

  if (pdf.sizeBytes !== null && pdf.sizeBytes > MAX_PDF_SIZE_BYTES) {
    throw new UploadError("File exceeds the 50MB limit", "too-large");
  }

  onProgress?.({ stage: "reading", percent: 10 });
  // React Native fetch supports file:// URIs; the resulting Blob is what
  // supabase-js storage uploads (the standard RN pattern).
  const response = await fetch(pdf.uri);
  const blob = await response.blob();
  if (blob.size > MAX_PDF_SIZE_BYTES) {
    throw new UploadError("File exceeds the 50MB limit", "too-large");
  }

  const sanitized = pdf.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `summaries/${Date.now()}_${sanitized}`;

  onProgress?.({ stage: "uploading", percent: 45 });
  const { error } = await supabase.storage
    .from(SUMMARIES_PDF_BUCKET)
    .upload(path, blob, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (error) {
    throw new UploadError(error.message, "upload-failed");
  }

  onProgress?.({ stage: "finalizing", percent: 90 });
  const { data } = supabase.storage.from(SUMMARIES_PDF_BUCKET).getPublicUrl(path);

  onProgress?.({ stage: "done", percent: 100 });
  return { path, publicUrl: data.publicUrl };
}