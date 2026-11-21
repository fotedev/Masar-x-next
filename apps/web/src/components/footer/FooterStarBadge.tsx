"use client";

import { Star } from "lucide-react";
import { GITHUB_REPO_URL } from "../../lib/github-stars";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface FooterStarBadgeProps {
  t: TranslationFn;
  /** Live stargazers_count from getRepoStars() (server-cached, spec 054); null = unavailable → plain star link. */
  stars: number | null;
  /** Active next-intl locale, threaded from Footer (compact formatting, FR-8). */
  locale: string;
}

/** Compact per-locale star count ("1.2K" in en, Arabic-Indic digits in ar) — spec FR-8. */
export function formatStarCount(stars: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact" }).format(stars);
}

export function FooterStarBadge({ t, stars, locale }: FooterStarBadgeProps) {
  const countLabel = stars === null ? null : formatStarCount(stars, locale);

  // Same anchor in both states (FR-2): with the count when the cached
  // GitHub fetch succeeded, without it on any failure — never an error
  // state. Each child is its own flex item, so RTL/LTR order comes from
  // the flex direction without bidi isolation tricks.
  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="w-fit flex items-center justify-center gap-x-2 px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group shadow-xs hover:shadow-md"
    >
      <Star className="w-4 h-4" />
      {countLabel !== null && <span className="tabular-nums">{countLabel}</span>}
      <span>{t("starOnGithub")}</span>
    </a>
  );
}
