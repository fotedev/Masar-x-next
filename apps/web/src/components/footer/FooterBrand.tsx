import { DynamicLogo } from "../DynamicLogo";
import { GITHUB_ORG_URL } from "../../lib/github-stars";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface FooterBrandProps {
  t: TranslationFn;
  /** Faculty sub-brand display name (spec 052); null/undefined = core Masar X. */
  facultyName?: string | null;
  /** "Powered by Masar X" line, shown only when a faculty preset is active. */
  facultyPoweredBy?: string | null;
}

export function FooterBrand({
  t,
  facultyName,
  facultyPoweredBy,
}: FooterBrandProps) {
  return (
    <div className="space-y-4 text-start">
      <div className="flex items-center gap-x-3">
        <DynamicLogo
          variant="mark"
          width={40}
          height={40}
          className="object-contain w-10 h-10"
        />
        <span className="text-lg font-bold text-slate-900 dark:text-white">
          {facultyName ?? t("brandTitle")}
        </span>
      </div>
      <p
        className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-xs"
        dir="auto"
      >
        {t("brandDescription")}
      </p>
      {/* Spec 054 (FR-5): the preset-sourced powered-by line now links to
          the Masar-X org. Still faculty-scoped only (core shows no
          powered-by line), per BRANDING.md §9 / spec 052. */}
      {facultyName && facultyPoweredBy ? (
        <a
          href={GITHUB_ORG_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("githubOrgAria")}
          className="w-fit block text-xs font-medium text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          dir="auto"
        >
          {facultyPoweredBy}
        </a>
      ) : null}
    </div>
  );
}
