"use client";

import { useLocale } from "next-intl";
import type { DriveGroup } from "@/lib/materials";

type Props = {
  groups: DriveGroup[];
  activeGroupIndex: number | null;
  activeChildIndex: number | null;
  onSelectGroup: (index: number) => void;
  onSelectChild: (index: number) => void;
};

/**
 * Group chips (one row per nesting level). The middle flex child truncates
 * and the layout keeps min-w-0 discipline so long Arabic names never overflow
 * the chip row (flex items never shrink below content without min-w-0).
 */
export function GroupChips({
  groups,
  activeGroupIndex,
  activeChildIndex,
  onSelectGroup,
  onSelectChild,
}: Props) {
  const locale = useLocale();
  const label = (g: DriveGroup) => (locale === "ar" ? g.nameAr : g.name);

  const activeGroup =
    activeGroupIndex !== null ? groups[activeGroupIndex] : undefined;
  const children = activeGroup?.children ?? [];

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={String(activeGroupIndex ?? "")}
      >
        {groups.map((group, i) => (
          <button
            key={group.folderId}
            type="button"
            role="tab"
            aria-selected={i === activeGroupIndex}
            onClick={() => onSelectGroup(i)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors truncate max-w-full ${
              i === activeGroupIndex
                ? "bg-brand-blue text-white border-brand-blue"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-blue"
            }`}
          >
            {label(group)}
          </button>
        ))}
      </div>

      {children.length > 0 && (
        <div className="flex flex-wrap gap-2 ps-3">
          {children.map((child, i) => (
            <button
              key={child.folderId}
              type="button"
              onClick={() => onSelectChild(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors truncate max-w-full ${
                i === activeChildIndex
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent"
                  : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-blue"
              }`}
            >
              {label(child)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
