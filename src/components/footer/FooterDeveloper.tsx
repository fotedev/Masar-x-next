import { Github, ExternalLink } from "lucide-react";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface FooterDeveloperProps {
  tFooter: TranslationFn;
}

export function FooterDeveloper({ tFooter }: FooterDeveloperProps) {
  return (
    <div>
      <h3 className="text-slate-900 dark:text-white font-bold mb-4 text-lg">
        {tFooter("developer")}
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
            <Github className="w-5 h-5 text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <h4 className="text-slate-900 dark:text-white font-bold text-sm">
              Aboalayoun
            </h4>
            <p className="text-slate-500 dark:text-slate-500 text-xs">
              AI student
            </p>
          </div>
        </div>
        <button
          onClick={() => window.open("https://github.com/Aboalayoun", "_blank")}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
        >
          <span>{tFooter("followOnGithub")}</span>
          <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}
