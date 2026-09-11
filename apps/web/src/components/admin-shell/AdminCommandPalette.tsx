"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Megaphone, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { adminNavGroups, type AdminTabId } from "@/lib/admin-shell/navigation";

/**
 * AdminCommandPalette - the Ctrl/Cmd+K quick-navigation dialog.
 *
 * Flat list of every admin section (filtered by role, mirroring the sidebar)
 * plus the "Create announcement" action. Type-to-filter, ArrowUp/Down to
 * move, Enter to run, Escape to dismiss. Focus is trapped while open.
 */

interface PaletteItem {
  id: string;
  icon: LucideIcon;
  label: string;
  groupLabel: string;
  run: () => void;
}

export interface AdminCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectTab: (tab: AdminTabId) => void;
  adminRole: string | null | undefined;
  onAddNew?: () => void;
}

export function AdminCommandPalette({
  open,
  onClose,
  onSelectTab,
  adminRole,
  onAddNew,
}: AdminCommandPaletteProps) {
  const t = useTranslations("adminDashboard");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const isDoctor = adminRole === "doctor";

  const items = useMemo<PaletteItem[]>(() => {
    const navItems: PaletteItem[] = adminNavGroups.flatMap((group) =>
      group.items
        .filter((item) => !item.doctorOnly || isDoctor)
        .map((item) => ({
          id: `tab-${item.id}`,
          icon: item.icon,
          label: t(item.labelKey),
          groupLabel: t(group.labelKey),
          run: () => onSelectTab(item.id),
        })),
    );

    const actionItems: PaletteItem[] = onAddNew
      ? [
          {
            id: "action-add-news",
            icon: Megaphone,
            label: t("overview.createAnnouncement"),
            groupLabel: t("overview.quickActions"),
            run: onAddNew,
          },
        ]
      : [];

    return [...actionItems, ...navItems];
  }, [t, isDoctor, onSelectTab, onAddNew]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.groupLabel.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Reset filter + selection + focus whenever the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    listRef.current
      ?.querySelectorAll('[role="option"]')
      [activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const runItem = (item: PaletteItem) => {
    onClose();
    item.run();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1),
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[activeIndex];
      if (item) runItem(item);
      return;
    }
    // Minimal focus trap: keep Tab cycling inside the dialog.
    if (event.key === "Tab") {
      event.preventDefault();
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center p-4 pt-[12vh]"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("commandPalette.title")}
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-ax-edge bg-ax-surface shadow-ax-lg"
      >
        <div className="flex items-center gap-3 border-b border-ax-edge px-4">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-ax-muted" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="ax-command-palette-list"
            aria-activedescendant={
              filtered[activeIndex]
                ? `ax-command-palette-option-${activeIndex}`
                : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder={t("commandPalette.inputPlaceholder")}
            className="h-12 w-full bg-transparent text-sm text-ax-primary outline-none placeholder:text-ax-muted"
          />
        </div>

        <ul
          id="ax-command-palette-list"
          ref={listRef}
          role="listbox"
          aria-label={t("commandPalette.title")}
          className="max-h-72 overflow-y-auto p-2"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-ax-muted">
              {t("commandPalette.noResults")}
            </li>
          ) : (
            filtered.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  id={`ax-command-palette-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => runItem(item)}
                  onMouseMove={() => setActiveIndex(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm outline-none transition-colors duration-150",
                    index === activeIndex
                      ? "bg-ax-accent-soft text-ax-primary"
                      : "text-ax-secondary",
                  )}
                >
                  <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-xs text-ax-muted">
                    {item.groupLabel}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
