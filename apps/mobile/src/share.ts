/**
 * Native OS share sheet (spec FR-012): share study content (a summary
 * card, a subject) through React Native's Share API, which maps to
 * UIActivityViewController on iOS and the system share intent on
 * Android.
 */
import { Share } from "react-native";

export interface ShareableStudyContent {
  title: string;
  /** Absolute URL when the row has one (e.g. summary pdf_url). */
  url?: string | null;
  /** Short text excerpt; kept small so share targets render it fully. */
  excerpt?: string | null;
  appName?: string;
}

export interface ShareResult {
  shared: boolean;
  dismissed: boolean;
}

export async function shareStudyContent(content: ShareableStudyContent): Promise<ShareResult> {
  const parts = [
    content.title,
    content.excerpt?.trim() ? content.excerpt.trim() : null,
    content.url?.trim() ? content.url.trim() : null,
    `— ${content.appName ?? "Masar X"}`,
  ].filter((part): part is string => Boolean(part));

  const message = parts.join("\n\n");

  try {
    const result = await Share.share({ message });
    return {
      shared: result.action === Share.sharedAction,
      dismissed: result.action === Share.dismissedAction,
    };
  } catch {
    return { shared: false, dismissed: true };
  }
}