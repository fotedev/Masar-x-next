import { Github, ExternalLink } from "lucide-react";
import { GITHUB_ORG_URL } from "../../lib/github-stars";
import { FooterStarBadge } from "./FooterStarBadge";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface FooterDeveloperProps {
  tFooter: TranslationFn;
  /** Live repo star count threaded from the server layout (spec 054); null/undefined = plain star link. */
  repoStars?: number | null;
  /** Active next-intl locale, threaded from Footer (compact count formatting, FR-8). */
  locale: string;
}

export function FooterDeveloper({ tFooter, repoStars, locale }: FooterDeveloperProps) {
  return (
    <div className="text-start flex flex-col items-start">
      <h3 className="text-slate-900 dark:text-white font-bold mb-4 text-lg">
        {tFooter("developer")}
      </h3>
      <div className="space-y-3 w-full">
        <div className="flex items-center gap-x-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
            <Github className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </div>
          <div className="text-start">
            <h4 className="text-slate-900 dark:text-white font-bold text-sm">
              Aboalayoun
            </h4>
            <p className="text-slate-500 dark:text-slate-500 text-xs">
              AI student
            </p>
          </div>
        </div>
        {/* Spec 054 (FR-1): the org profile replaces the personal fotedev
            link, as a real anchor (accessible name + middle-click) instead
            of a window.open button. */}
        <a
          href={GITHUB_ORG_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit flex items-center justify-center gap-x-2 px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group shadow-xs hover:shadow-md"
        >
          <Github className="w-4 h-4" />
          <span>{tFooter("followOnGithub")}</span>
          <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 opacity-50" />
        </a>
        {/* Spec 054 (FR-2): star badge with the live cached count; degrades
            to a plain star link when the GitHub fetch fails. */}
        <FooterStarBadge t={tFooter} stars={repoStars ?? null} locale={locale} />
      </div>
    </div>
  );
}
