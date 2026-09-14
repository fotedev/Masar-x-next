"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ChevronRight,
  Flag,
  HelpCircle,
  Inbox,
  Megaphone,
  Newspaper,
  Plus,
  School,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminStatusBadge, type AdminBadgeTone } from "./AdminDataTable";
import type { AdminTabId } from "@/lib/admin-shell/navigation";

/**
 * AdminOverviewTab - the admin landing view.
 *
 * Identity note (spec 006): Masar X is a study platform (subjects +
 * lectures + quizzes + the ZANE assistant); summaries are retired from
 * admin. This view leads with subjects and treats quizzes and news as the
 * content streams in the activity feed. Full management grids live in
 * their own views; this view only summarizes and links into them.
 *
 * Layout: a 4-up KPI grid, then a 2/3 + 1/3 split — one compact
 * "Recent activity" feed next to Quick Actions / review-queue panels.
 *
 * Data comes from the hooks already instantiated by
 * app/[locale]/admin-dashboard/page.tsx - no extra fetching here.
 */

export interface SubjectLike {
  id: string;
  name: string;
  created_at?: string | null;
}

export interface NewsLike {
  id: string;
  title?: string | null;
  subject?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
}

export interface QuizLike {
  id: string;
  title?: string | null;
  subject?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export interface AdminOverviewTabProps {
  subjects: SubjectLike[];
  news: NewsLike[];
  quizzes: QuizLike[];
  appealsCount: number;
  onNavigate?: (tab: AdminTabId) => void;
  onAddNew?: () => void;
  onAddSubject?: () => void;
}

interface KpiChip {
  label: string;
  tone: "success" | "warning";
}

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "neutral" | "accent" | "warning" | "info";
  chip?: KpiChip;
}

const KPI_TONE: Record<KpiCardProps["tone"], { icon: string }> = {
  neutral: { icon: "bg-ax-surface-inset text-ax-secondary" },
  accent: { icon: "bg-ax-accent-soft text-ax-accent" },
  warning: { icon: "bg-ax-warning-soft text-ax-warning" },
  info: { icon: "bg-ax-info-soft text-ax-info" },
};

const CHIP_TONE: Record<KpiChip["tone"], string> = {
  success: "bg-ax-success-soft text-ax-success",
  warning: "bg-ax-warning-soft text-ax-warning",
};

function KpiCard({ icon: Icon, label, value, tone, chip }: KpiCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-ax-edge bg-ax-surface p-5 shadow-ax-sm">
      <span
        aria-hidden="true"
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
          KPI_TONE[tone].icon,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ax-secondary">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-ax-primary">
          {value.toLocaleString()}
        </p>
        {chip ? (
          <span
            className={cn(
              "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
              CHIP_TONE[chip.tone],
            )}
          >
            {chip.label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toISOString().slice(0, 10);
}

function isWithinLastWeek(value: string | null | undefined): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return Date.now() - time <= 7 * 24 * 60 * 60 * 1000;
}

type ActivityKind = "news" | "quiz";

interface RecentItem {
  id: string;
  kind: ActivityKind;
  title: string;
  subject: string;
  statusLabel: string;
  tone: AdminBadgeTone;
  createdAt: string | null;
  tab: AdminTabId;
}

/** Review-model status mapping shared by summaries and quizzes. */
function reviewTone(status: string): AdminBadgeTone {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function reviewLabel(status: string, t: ReturnType<typeof useTranslations>): string {
  if (status === "approved") return t("table.statusPublished");
  if (status === "rejected") return t("table.statusRejected");
  return t("table.statusPending");
}

function overviewCardClass() {
  return "overflow-hidden rounded-xl border border-ax-edge bg-ax-surface shadow-ax-sm";
}

export function AdminOverviewTab({
  subjects,
  news,
  quizzes,
  appealsCount,
  onNavigate,
  onAddNew,
  onAddSubject,
}: AdminOverviewTabProps) {
  const t = useTranslations("adminDashboard");

  const recentItems = useMemo<RecentItem[]>(() => {
    const newsItems: RecentItem[] = news.map((row) => ({
      id: `news-${row.id}`,
      kind: "news",
      title: row.title ?? "\u2014",
      subject: row.subject ?? "",
      statusLabel: row.is_active
        ? t("table.statusPublished")
        : t("table.statusDraft"),
      tone: row.is_active ? "success" : "neutral",
      createdAt: row.created_at ?? null,
      tab: "news",
    }));

    const quizItems: RecentItem[] = quizzes.map((row) => {
      const status = row.status ?? "";
      return {
        id: `quiz-${row.id}`,
        kind: "quiz",
        title: row.title ?? "\u2014",
        subject: row.subject ?? "",
        statusLabel: reviewLabel(status, t),
        tone: reviewTone(status),
        createdAt: row.created_at ?? null,
        tab: "quizzes",
      };
    });

    return [...newsItems, ...quizItems]
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 6);
  }, [news, quizzes, t]);

  const newSubjectsThisWeek = useMemo(
    () => subjects.filter((row) => isWithinLastWeek(row.created_at)).length,
    [subjects],
  );
  const newNewsThisWeek = useMemo(
    () => news.filter((row) => isWithinLastWeek(row.created_at)).length,
    [news],
  );
  const newQuizzesThisWeek = useMemo(
    () => quizzes.filter((row) => isWithinLastWeek(row.created_at)).length,
    [quizzes],
  );

  const weekChip = (count: number): KpiChip | undefined =>
    count > 0
      ? { label: `+${count} ${t("overview.newThisWeek")}`, tone: "success" }
      : undefined;

  const quickActions = [
    {
      id: "add-subject",
      icon: School,
      label: t("overview.addSubject"),
      onClick: onAddSubject,
      variant: "primary" as const,
    },
    {
      id: "add-news",
      icon: Megaphone,
      label: t("overview.createAnnouncement"),
      onClick: onAddNew,
      variant: "secondary" as const,
    },
    {
      id: "review-appeals",
      icon: Flag,
      label: t("overview.reviewAppeals"),
      onClick: () => onNavigate?.("appeals"),
      variant: "secondary" as const,
    },
  ];

  const attentionRows = [
    {
      id: "appeals",
      label: t("kpi.pendingAppeals"),
      count: appealsCount,
      tab: "appeals" as AdminTabId,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={School}
          label={t("kpi.totalSubjects")}
          value={subjects.length}
          tone="accent"
          chip={weekChip(newSubjectsThisWeek)}
        />
        <KpiCard
          icon={Newspaper}
          label={t("kpi.totalNews")}
          value={news.length}
          tone="info"
          chip={weekChip(newNewsThisWeek)}
        />
        <KpiCard
          icon={HelpCircle}
          label={t("kpi.totalQuizzes")}
          value={quizzes.length}
          tone="neutral"
          chip={weekChip(newQuizzesThisWeek)}
        />
        <KpiCard
          icon={Flag}
          label={t("kpi.pendingAppeals")}
          value={appealsCount}
          tone="warning"
          chip={
            appealsCount > 0
              ? { label: t("kpi.needsReview"), tone: "warning" }
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity — compact mixed feed; full grids live in their own tabs */}
        <section
          aria-labelledby="ax-recent-activity"
          className={cn(overviewCardClass(), "lg:col-span-2")}
        >
          <div className="border-b border-ax-edge px-5 py-4">
            <h2
              id="ax-recent-activity"
              className="text-base font-semibold text-ax-primary"
            >
              {t("overview.recentActivity")}
            </h2>
            <p className="mt-0.5 text-sm text-ax-muted">
              {t("overview.recentActivityHint")}
            </p>
          </div>

          {recentItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-ax-surface-inset text-ax-muted"
              >
                <Inbox className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-ax-primary">
                {t("overview.emptyTitle")}
              </p>
              <p className="max-w-xs text-sm text-ax-muted">
                {t("overview.emptyHint")}
              </p>
              <button
                type="button"
                onClick={() => onAddSubject?.()}
                className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-ax-accent px-4 text-sm font-semibold text-ax-on-accent outline-none transition-colors duration-150 hover:bg-ax-accent-hover focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t("overview.addSubject")}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-ax-edge">
              {recentItems.map((item) => {
                const KindIcon = item.kind === "news" ? Newspaper : HelpCircle;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-ax-surface-hover"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ax-surface-inset text-ax-secondary"
                    >
                      <KindIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ax-primary">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-ax-muted">
                        {item.kind === "news"
                          ? t("overview.kindNews")
                          : t("overview.kindQuiz")}
                        {item.subject ? ` · ${item.subject}` : ""}
                      </p>
                    </div>
                    <AdminStatusBadge tone={item.tone}>
                      {item.statusLabel}
                    </AdminStatusBadge>
                    <span className="hidden w-24 shrink-0 text-end text-xs tabular-nums text-ax-muted sm:block">
                      {formatDate(item.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate?.(item.tab)}
                      aria-label={`${t("table.view")}: ${item.title}`}
                      className="shrink-0 rounded-md p-1.5 text-ax-muted outline-none transition-colors duration-150 hover:bg-ax-accent-soft hover:text-ax-accent focus-visible:ring-2 focus-visible:ring-ax-accent"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 rtl:rotate-180"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right rail: quick actions + review queue */}
        <div className="flex flex-col gap-4">
          <section
            aria-labelledby="ax-quick-actions"
            className={overviewCardClass()}
          >
            <div className="border-b border-ax-edge px-5 py-4">
              <h2
                id="ax-quick-actions"
                className="text-base font-semibold text-ax-primary"
              >
                {t("overview.quickActions")}
              </h2>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.onClick}
                  disabled={!action.onClick}
                  className={cn(
                    "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface disabled:opacity-50",
                    action.variant === "primary"
                      ? "bg-ax-accent text-ax-on-accent hover:bg-ax-accent-hover"
                      : "border border-ax-edge bg-ax-surface-inset text-ax-primary hover:border-ax-edge-strong hover:bg-ax-surface-hover",
                  )}
                >
                  <action.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="ax-needs-attention"
            className={overviewCardClass()}
          >
            <div className="border-b border-ax-edge px-5 py-4">
              <h2
                id="ax-needs-attention"
                className="text-base font-semibold text-ax-primary"
              >
                {t("overview.needsAttention")}
              </h2>
            </div>
            {appealsCount === 0 ? (
              <div className="flex items-center gap-3 px-5 py-5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ax-success-soft text-ax-success"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <p className="text-sm text-ax-secondary">
                  {t("overview.allClear")}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-ax-edge">
                {attentionRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate?.(row.tab)}
                      disabled={row.count === 0}
                      className="flex w-full items-center gap-3 px-5 py-3 text-start outline-none transition-colors duration-150 hover:bg-ax-surface-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ax-accent disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          row.count > 0 ? "bg-ax-warning" : "bg-ax-edge-strong",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-ax-secondary">
                        {row.label}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ax-primary">
                        {row.count.toLocaleString()}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-ax-muted rtl:rotate-180"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
