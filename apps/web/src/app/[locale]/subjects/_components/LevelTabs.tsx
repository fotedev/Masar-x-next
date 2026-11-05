"use client";

import type { AcademicLevelOption } from "@/hooks/useAcademicOptions";

type Props = {
  levels: AcademicLevelOption[];
  active: number;
  onSelect: (levelNumber: number) => void;
};

/**
 * Spec 034 — level switcher for the /subjects catalog. Defaults come from
 * the academic_levels table (canonical Arabic names); the caller resolves
 * the viewer's own level as the initial selection.
 */
export function LevelTabs({ levels, active, onSelect }: Props) {
  if (levels.length === 0) return null;

  return (
    <div
      className="flex flex-wrap justify-center gap-2"
      data-testid="subjects-level-tabs"
    >
      {levels.map((level) => {
        const levelNumber = level.level_number ?? Number(level.name) ?? 0;
        return (
          <button
            key={level.id}
            type="button"
            onClick={() => onSelect(levelNumber)}
            aria-pressed={levelNumber === active}
            data-testid="subjects-level-tab"
            data-level={levelNumber}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              levelNumber === active
                ? "bg-brand-blue text-white border-brand-blue"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-blue"
            }`}
          >
            {level.name}
          </button>
        );
      })}
    </div>
  );
}
