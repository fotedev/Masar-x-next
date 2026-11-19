import { DynamicLogo } from "../DynamicLogo";

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
      {facultyName && facultyPoweredBy ? (
        <p
          className="text-xs font-medium text-slate-500 dark:text-slate-500"
          dir="auto"
        >
          {facultyPoweredBy}
        </p>
      ) : null}
    </div>
  );
}
