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
  return locale === "ar" ? "/logo_AR.webp" : "/logo_EN.webp";
}

/**
 * A reusable Image component that automatically switches its source
 * based on the current locale.
 */
export function DynamicLogo({ alt = "Masar X Logo", ...props }: DynamicLogoProps) {
  const locale = useLocale();
  const src = getLogoPath(locale);

  const eagerLoadingProps: Partial<ImageProps> = props.priority
    ? { loading: "eager" }
    : {};

  const fetchPriorityProps: any =
    props.priority && typeof (props as any).fetchPriority === "undefined"
      ? { fetchPriority: "high" }
      : {};

  return (
    <Image
      src={src}
      alt={alt}
      {...eagerLoadingProps}
      {...fetchPriorityProps}
      {...props}
    />
  );
}
