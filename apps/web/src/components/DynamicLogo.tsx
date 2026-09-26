"use client";

import Image, { ImageProps } from "next/image";

const LOCKUP_PATH = "/logo_lockup.svg";
const MARK_PATH = "/masarx-mark.svg";

interface DynamicLogoProps extends Omit<ImageProps, "src" | "alt"> {
  alt?: string;
  /** "lockup" = horizontal mark + MASARX wordmark (navbars); "mark" = standalone mark (square/icon slots). */
  variant?: "lockup" | "mark";
}

/**
 * Mark-only logo path (notification icons and other square contexts).
 * Locale-independent since the global wordmark policy (owner decision 2026-09-23).
 */
export function getLogoPath(_locale?: string) {
  return MARK_PATH;
}

/**
 * Horizontal lockup (mark + «MASARX» wordmark) — the official navbar form
 * for both locales per BRANDING.md §7.3 rule 3 (amended 2026-09-23).
 */
export function getLockupPath() {
  return LOCKUP_PATH;
}

/**
 * Reusable Image component for the brand logo. Source is locale-independent;
 * pick `variant` per context ("lockup" for header-style rows, "mark" for
 * square slots paired with adjacent text).
 */
export function DynamicLogo({
  alt = "Masar X Logo",
  variant = "lockup",
  ...props
}: DynamicLogoProps) {
  const src = variant === "mark" ? MARK_PATH : LOCKUP_PATH;

  const eagerLoadingProps: Partial<ImageProps> = props.priority
    ? { loading: "eager" }
    : {};

  const fetchPriorityProps: { fetchPriority?: "high" } =
    props.priority && props.fetchPriority === undefined
      ? { fetchPriority: "high" }
      : {};

  return (
    <Image
      src={src}
      alt={alt}
      unoptimized
      {...eagerLoadingProps}
      {...fetchPriorityProps}
      {...props}
    />
  );
}
