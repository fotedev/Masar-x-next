import Link from "next/link";
import {
  LayoutDashboard,
  Newspaper,
  BookOpen,
  MessageSquare,
  Shield,
  ExternalLink,
  HelpCircle,
  ChevronRight,
} from "lucide-react";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface FooterLinksProps {
  tFooter: TranslationFn;
  tNav: TranslationFn;
  localePrefix: string;
  trwWhatsappUrl: string;
}

export function FooterLinks({
  tFooter,
  tNav,
  localePrefix,
  trwWhatsappUrl,
}: FooterLinksProps) {
  const links = [
    { href: `${localePrefix}/`, label: tNav("home"), icon: LayoutDashboard },
    { href: `${localePrefix}/news`, label: tNav("news"), icon: Newspaper },
    { href: `${localePrefix}/subjects`, label: tNav("subjects"), icon: BookOpen },
    { href: `${localePrefix}/quizzes`, label: tNav("quizzes"), icon: MessageSquare },
    { href: `${localePrefix}/faq`, label: tFooter("faq"), icon: HelpCircle },
    { href: `${localePrefix}/privacy`, label: tFooter("privacyPolicy"), icon: Shield },
  ];

  return (
    <div className="flex flex-col h-full rtl:items-end">
      <h3 className="text-slate-900 dark:text-white font-bold mb-3 text-lg flex items-center gap-2 rtl:flex-row-reverse">
        <span className="w-8 h-1 bg-brand-blue rounded-full"></span>
        {tFooter("quickLinks")}
      </h3>
      
      <nav className="flex-grow w-full">
        <ul className="space-y-0.5">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="group flex items-center justify-between py-1 px-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-brand-blue dark:hover:text-brand-blue transition-all duration-300 rtl:flex-row-reverse"
              >
                <div className="flex items-center gap-3 rtl:flex-row-reverse">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-brand-blue/10 group-hover:text-brand-blue transition-colors duration-300">
                    <link.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-semibold tracking-wide">
                    {link.label}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 rtl:rotate-180 rtl:translate-x-2 rtl:group-hover:translate-x-0" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Special Section: The Real World */}
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 w-full">
        <a
          href={trwWhatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="relative group block p-3 rounded-2xl bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-slate-900 border border-red-100 dark:border-red-900/30 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-1"
        >
          {/* Background Glow */}
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all duration-500"></div>
          
          <div className="relative z-10 rtl:text-right">
            <div className="flex items-center justify-between mb-2 rtl:flex-row-reverse">
              <span className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-tighter">
                The Real World
              </span>
              <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded-full">
                <div className="w-1.5 h-1.5 bg-red-600 dark:bg-red-400 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">TRW</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between gap-3 rtl:flex-row-reverse">
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-snug">
                {tFooter("trwCaption")}
              </p>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-600/20 group-hover:scale-110 transition-transform duration-300">
                <ExternalLink className="w-4 h-4" />
              </div>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}

