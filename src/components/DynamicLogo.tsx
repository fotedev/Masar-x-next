"use client";

import Image, { ImageProps } from "next/image";
import { useLocale } from "next-intl";

interface DynamicLogoProps extends Omit<ImageProps, "src" | "alt"> {
  alt?: string;
}

/**
 * Utility function to get the logo path based on locale.
 * Useful for non-component contexts like notifications or server-side logic.
 */
export function getLogoPath(locale: string) {
  return locale === "ar" ? "/logo_AR.png" : "/logo_EN.png";
}

/**
 * A reusable Image component that automatically switches its source
 * based on the current locale.
 */
export function DynamicLogo({ alt = "Masar X Logo", ...props }: DynamicLogoProps) {
  const locale = useLocale();
  const src = getLogoPath(locale);

  return (
    <Image
      src={src}
      alt={alt}
      {...props}
    />
  );
}
