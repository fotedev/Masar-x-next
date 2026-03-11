import Image from "next/image";

interface FooterBrandProps {
  t: any;
}

export function FooterBrand({ t }: FooterBrandProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
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
      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-xs">
        {t("brandDescription")}
      </p>
    </div>
  );
}
