import Image from "next/image";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

interface FooterBrandProps {
  t: TranslationFn;
}

export function FooterBrand({ t }: FooterBrandProps) {
  return (
    <div className="space-y-4 rtl:text-right">
      <div className="flex items-center gap-3 rtl:flex-row-reverse">
        <Image
          src="/logo.png"
          alt="Masar X Logo"
          width={40}
          height={40}
          className="object-contain w-10 h-10"
        />
        <span className="text-lg font-bold text-slate-900 dark:text-white">
          {t("brandTitle")}
        </span>
      </div>
      <p 
        className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-xs rtl:mr-0 rtl:ml-auto"
        dir="auto"
      >
        {t("brandDescription")}
      </p>
    </div>
  );
}
