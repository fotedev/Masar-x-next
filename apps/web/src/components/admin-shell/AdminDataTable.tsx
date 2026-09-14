"use client";

import type { ReactNode } from "react";
import { Inbox, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AdminStatusBadge - small pill used in table cells for row state.
 * Tones map onto the namespaced --ax-* feedback tokens, so they stay
 * WCAG AA compliant in both themes (verified by the token contrast audit).
 */
export type AdminBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<AdminBadgeTone, string> = {
  neutral: "bg-ax-surface-inset text-ax-secondary",
  info: "bg-ax-info-soft text-ax-info",
  success: "bg-ax-success-soft text-ax-success",
  warning: "bg-ax-warning-soft text-ax-warning",
  danger: "bg-ax-danger-soft text-ax-danger",
};

export function AdminStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: AdminBadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

export interface AdminTableColumn<T> {
  /** Stable column id, used as the React key. */
  id: string;
  /** Visible column header (already localised by the caller). */
  header: string;
  /** Cell renderer. */
  render: (row: T) => ReactNode;
  /** Extra classes applied to both the th and the td. */
  className?: string;
}

export interface AdminDataTableProps<T> {
  /** Accessible table caption (sr-only). */
  caption: string;
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  actionLabel: string;
  onAction: () => void;
  actionsHeader: string;
  emptyLabel: string;
  /** Optional secondary line under the empty label. */
  emptyHint?: string;
  /** Optional primary action rendered under the empty state copy. */
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  renderActions?: (row: T) => ReactNode;
}

/**
 * AdminDataTable - structured, accessible data table for admin views.
 *
 * - Real <table> semantics: sr-only <caption>, scope="col" on every header.
 * - Toolbar carries the search field (labelled) and the primary "Add New"
 *   action; the button is a 44px target.
 * - Horizontal overflow scrolls inside the card, never the page.
 * - Empty state renders a single full-width cell instead of a blank body.
 */
export function AdminDataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  actionLabel,
  onAction,
  actionsHeader,
  emptyLabel,
  emptyHint,
  emptyActionLabel,
  onEmptyAction,
  renderActions,
}: AdminDataTableProps<T>) {
  return (
    <section className="overflow-hidden rounded-xl border border-ax-edge bg-ax-surface shadow-sm">
      <div className="flex flex-col gap-3 border-b border-ax-edge p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative flex w-full items-center sm:max-w-xs">
          <span className="sr-only">{searchLabel}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 h-4 w-4 text-ax-muted"
          />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-md border border-ax-edge bg-ax-canvas ps-9 pe-3 text-sm text-ax-primary outline-none transition-colors duration-150 placeholder:text-ax-muted focus-visible:border-ax-accent focus-visible:ring-2 focus-visible:ring-ax-accent"
          />
        </label>

        <button
          type="button"
          onClick={onAction}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-ax-accent px-4 text-sm font-semibold text-ax-on-accent outline-none transition-colors duration-150 hover:bg-ax-accent-hover focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {actionLabel}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-start text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-ax-edge bg-ax-surface-inset">
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-start text-xs font-semibold tracking-wider text-ax-muted uppercase",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
              <th
                scope="col"
                className="px-4 py-3 text-end text-xs font-semibold tracking-wider text-ax-muted uppercase"
              >
                {actionsHeader}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-center">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-ax-surface-inset text-ax-muted"
                    >
                      <Inbox className="h-5 w-5" />
                    </span>
                    <p className="text-sm font-medium text-ax-primary">
                      {emptyLabel}
                    </p>
                    {emptyHint ? (
                      <p className="text-sm text-ax-muted">{emptyHint}</p>
                    ) : null}
                    {emptyActionLabel ? (
                      <button
                        type="button"
                        onClick={() => onEmptyAction?.()}
                        className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-ax-accent px-4 text-sm font-semibold text-ax-on-accent outline-none transition-colors duration-150 hover:bg-ax-accent-hover focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface"
                      >
                        <Plus aria-hidden="true" className="h-4 w-4" />
                        {emptyActionLabel}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-ax-edge transition-colors duration-150 last:border-b-0 hover:bg-ax-surface-hover"
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn("px-4 py-3 align-middle text-ax-secondary", column.className)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-end">{renderActions?.(row)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
