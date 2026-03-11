import Link from "next/link";
import {
  LayoutDashboard,
  Newspaper,
  BookOpen,
  MessageSquare,
  Shield,
  ExternalLink,
} from "lucide-react";

interface FooterLinksProps {
  tFooter: any;
  tNav: any;
  localePrefix: string;
  trwWhatsappUrl: string;
}

export function FooterLinks({
  tFooter,
  tNav,
  localePrefix,
  trwWhatsappUrl,
}: FooterLinksProps) {
  return (
    <div>
      <h3 className="text-slate-900 dark:text-white font-bold mb-4 text-lg">
        {tFooter("quickLinks")}
      </h3>
      <ul className="space-y-3">
        <li>
          <Link
            href={`${localePrefix}/`}
            className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
          >
            <LayoutDashboard className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span>{tNav("home")}</span>
          </Link>
        </li>
        <li>
          <Link
            href={`${localePrefix}/news`}
            className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
          >
            <Newspaper className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span>{tNav("news")}</span>
          </Link>
        </li>
        <li>
          <Link
            href={`${localePrefix}/subjects`}
            className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
          >
            <BookOpen className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span>{tNav("subjects")}</span>
          </Link>
        </li>
        <li>
          <Link
            href={`${localePrefix}/quizzes`}
            className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
          >
            <MessageSquare className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span>{tNav("quizzes")}</span>
          </Link>
        </li>
        <li>
          <Link
            href={`${localePrefix}/faq`}
            className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
          >
            <span className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              ❓
            </span>
            <span>{tFooter("faq")}</span>
          </Link>
        </li>
        <li>
          <Link
            href={`${localePrefix}/privacy`}
            className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
          >
            <Shield className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span>{tFooter("privacyPolicy")}</span>
          </Link>
        </li>
        <li className="pt-2 border-t border-slate-100 dark:border-white/5 mt-2">
          <a
            href={trwWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-1 group/trw"
          >
            <div className="flex items-center gap-2 text-red-500 dark:text-red-400 hover:text-red-600 transition-colors text-sm font-bold animate-pulse group-hover/trw:animate-none">
              <span>The Real World</span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover/trw:opacity-100 transition-opacity" />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 pr-7 leading-tight">
              {tFooter("trwCaption")}
            </p>
          </a>
        </li>
      </ul>
    </div>
  );
}
