"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations("theme");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a fixed-size placeholder until mount so server and client HTML
  // match (ThemeContext defaults to "light" and corrects from
  // localStorage/media query in an effect after hydration).
  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-transparent select-none"
      >
        <span className="block w-4 h-4" />
      </span>
    );
  }

  const isDark = theme === "dark";
  const label = isDark ? t("enableLight") : t("enableDark");

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-white/5 transition-all duration-200"
      aria-label={label}
      title={label}
      type="button"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
