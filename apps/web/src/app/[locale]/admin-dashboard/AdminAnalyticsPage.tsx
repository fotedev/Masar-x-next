"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Eye,
  MessageSquare,
  MousePointer,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/admin-shell/StatCard";
import { PageHeader } from "@/components/admin-shell/PageHeader";

/**
 * Lean-metrics payload from GET /api/admin/metrics (Redis counters +
 * Postgres assistant-message counts). "Views" means file downloads and
 * "Clicks" means AI questions — the card labels in the dashboard i18n
 * were relabeled to match; the keys keep their historical names.
 */
interface AdminMetricsPayload {
  totalUsers: number;
  totalMessages: number;
  totalViews: number;
  totalClicks: number;
  topContentTypes: Array<{ type: string; count: number }>;
  recentActivity: Array<{
    action: string;
    content_type: string;
    created_at: string;
  }>;
  dailyCounts: Array<{
    date: string;
    downloads: number;
    aiQuestions: number;
    activeUsers: number;
    assistantMessages: number;
  }>;
  redisConfigured: boolean;
}

interface MicroTrend {
  direction: "up" | "down" | "flat";
  pct: number;
}

/**
 * Honest 7d-vs-prior-7d trends from the server's daily buckets — no more
 * math on capped activity rows. `activeUsers` per day is a per-day HLL
 * count, so window sums can double-count users active on multiple days;
 * acceptable for a directional badge.
 */
function calculateMicroTrends(
  days: AdminMetricsPayload["dailyCounts"] = [],
): Record<"views" | "clicks" | "assistantMessages" | "activeUsers", MicroTrend | null> {
  const current = days.slice(-7);
  const previous = days.slice(-14, -7);

  const sum = (
    window: AdminMetricsPayload["dailyCounts"],
    pick: (day: AdminMetricsPayload["dailyCounts"][number]) => number,
  ): number => window.reduce((acc, day) => acc + pick(day), 0);

  const computeDelta = (
    currentTotal: number,
    previousTotal: number,
  ): MicroTrend | null => {
    // If either window has zero events for a metric: render NO trend badge (neutral).
    if (currentTotal === 0 || previousTotal === 0) return null;
    const diff = currentTotal - previousTotal;
    if (diff === 0) return { direction: "flat", pct: 0 };
    const pct = Math.round(Math.abs(diff / previousTotal) * 100);
    return {
      direction: diff > 0 ? "up" : "down",
      pct,
    };
  };

  return {
    views: computeDelta(sum(current, (d) => d.downloads), sum(previous, (d) => d.downloads)),
    clicks: computeDelta(
      sum(current, (d) => d.aiQuestions),
      sum(previous, (d) => d.aiQuestions),
    ),
    assistantMessages: computeDelta(
      sum(current, (d) => d.assistantMessages),
      sum(previous, (d) => d.assistantMessages),
    ),
    activeUsers: computeDelta(
      sum(current, (d) => d.activeUsers),
      sum(previous, (d) => d.activeUsers),
    ),
  };
}

export const AdminAnalyticsPage = () => {
  const locale = useLocale();
  const t = useTranslations("adminDashboard.analytics");
  const tTrends = useTranslations("adminDashboard.trends");
  const tNav = useTranslations("nav");
  const assistantName = tNav("assistant");

  // ar-EG keeps the Arabic-Indic digits + Gregorian calendar the page
  // always rendered; en-US switches Latin digits for English admins.
  const intlLocale = locale === "ar" ? "ar-EG" : "en-US";
  const { isAdmin } = useAuth();
  const [analytics, setAnalytics] = useState<AdminMetricsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat(intlLocale).format(value);
  };

  const formatDateTime = (value: string) => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString(intlLocale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getActionLabel = (action: string) => {
    const a = (action || "").toLowerCase();
    switch (a) {
      case "page_view":
        return t("action.page_view");
      case "click":
        return t("action.click");
      case "ai_interaction":
        return t("action.ai_interaction");
      case "user_login":
        return t("action.user_login");
      case "user_logout":
        return t("action.user_logout");
      case "content_view":
        return t("action.content_view");
      case "summary_click":
        return t("action.summary_click");
      case "link_click":
        return t("action.link_click");
      case "summary_view":
        return t("action.summary_view");
      case "file_download":
        return t("action.file_download");
      case "ai_question":
        return t("action.ai_question");
      default:
        return action || t("action.fallback");
    }
  };

  const getContentLabel = (contentType: string) => {
    const t2 = (contentType || "").toLowerCase();
    if (t2 === "ai_assistant") return `${assistantName} AI`;
    switch (t2) {
      case "summary":
        return t("contentType.summary");
      case "course":
        return t("contentType.course");
      case "quiz":
        return t("contentType.quiz");
      case "page":
        return t("contentType.page");
      case "file":
        return t("contentType.file");
      case "login":
        return t("contentType.login");
      case "logout":
        return t("contentType.logout");
      case "unknown":
        return t("contentType.unknown");
      default:
        return contentType || t("contentType.fallback");
    }
  };

  const actionBadgeClass = (action: string) => {
    const a = (action || "").toLowerCase();
    if (a === "page_view") return "bg-ax-info-soft text-ax-info";
    if (a === "click" || a === "link_click") return "bg-ax-warning-soft text-ax-warning";
    if (a === "ai_interaction" || a === "ai_question_asked" || a === "ai_question") return "bg-ax-accent-soft text-ax-accent";
    if (a === "file_download" || a === "summary_click" || a === "link_click") return "bg-ax-warning-soft text-ax-warning";
    if (a === "user_login") return "bg-ax-success-soft text-ax-success";
    if (a === "user_logout") return "bg-ax-danger-soft text-ax-danger";
    return "bg-ax-surface-inset text-ax-secondary";
  };

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isAdmin) {
        setError(t("errors.unauthorized"));
        return;
      }
      const res = await fetch("/api/admin/metrics", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setError(t("errors.unauthorized"));
        return;
      }
      if (!res.ok) {
        setError(t("errors.loadFailed"));
        return;
      }
      const payload = (await res.json()) as AdminMetricsPayload;
      setAnalytics({
        totalUsers: payload.totalUsers || 0,
        totalMessages: payload.totalMessages || 0,
        totalViews: payload.totalViews || 0,
        totalClicks: payload.totalClicks || 0,
        topContentTypes: payload.topContentTypes || [],
        recentActivity: payload.recentActivity || [],
        dailyCounts: payload.dailyCounts || [],
        redisConfigured: Boolean(payload.redisConfigured),
      });
    } catch {
      setError(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const trends = useMemo(() => {
    return calculateMicroTrends(analytics?.dailyCounts);
  }, [analytics?.dailyCounts]);

  const renderTrendBadge = (trend: MicroTrend | null) => {
    if (!trend) return null;
    if (trend.direction === "flat") {
      return (
        <span
          title={tTrends("vsPrevious")}
          aria-label={`${tTrends("flat")} - ${tTrends("vsPrevious")}`}
          className="inline-flex items-center gap-1 rounded-full bg-ax-surface-inset px-2 py-0.5 text-[11px] font-medium text-ax-muted sm:text-xs"
        >
          <span>{tTrends("flat")}</span>
        </span>
      );
    }
    const isUp = trend.direction === "up";
    const TrendIcon = isUp ? TrendingUp : TrendingDown;
    return (
      <span
        title={tTrends("vsPrevious")}
        aria-label={`${isUp ? tTrends("up", { value: trend.pct }) : tTrends("down", { value: trend.pct })} - ${tTrends("vsPrevious")}`}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:text-xs",
          isUp
            ? "bg-ax-success-soft text-ax-success"
            : "bg-ax-warning-soft text-ax-warning",
        )}
      >
        <TrendIcon className="h-3 w-3" />
        <span>
          {isUp
            ? tTrends("up", { value: trend.pct })
            : tTrends("down", { value: trend.pct })}
        </span>
      </span>
    );
  };

  const focusRing =
    "focus-visible:ring-2 focus-visible:ring-ax-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ax-surface";

  if (loading) {
    return (
      <div className="rounded-xl border border-ax-edge bg-ax-surface p-8 text-center shadow-ax-sm">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-ax-accent border-t-transparent" />
        <p className="text-sm text-ax-muted">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-ax-edge bg-ax-surface p-8 text-center shadow-ax-sm">
        <p className="mb-4 text-sm font-medium text-ax-danger">{error}</p>
        <button
          type="button"
          onClick={loadAnalytics}
          className={cn(
            "inline-flex h-11 items-center justify-center rounded-lg bg-ax-accent px-5 text-sm font-semibold text-ax-on-accent outline-hidden transition-colors duration-150 hover:bg-ax-accent-hover",
            focusRing,
          )}
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 border-t border-ax-edge pt-6">
      <PageHeader
        icon={BarChart3}
        title={t("title")}
        description={t("subtitle")}
      />

      {!analytics?.redisConfigured && (
        <p className="rounded-lg border border-ax-edge bg-ax-surface-inset px-4 py-3 text-xs text-ax-muted">
          {t("redisNotice")}
        </p>
      )}

      {/* Summary Cards: 2x2 grid on mobile (<lg), 4-col on lg+ */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label={t("cards.activeUsers")}
          value={formatNumber(analytics?.totalUsers || 0)}
          tone="accent"
          trend={renderTrendBadge(trends.activeUsers)}
        />
        <StatCard
          icon={MessageSquare}
          label={t("cards.assistantMessages")}
          value={formatNumber(analytics?.totalMessages || 0)}
          tone="info"
          trend={renderTrendBadge(trends.assistantMessages)}
        />
        <StatCard
          icon={Eye}
          label={t("cards.views")}
          value={formatNumber(analytics?.totalViews || 0)}
          tone="neutral"
          trend={renderTrendBadge(trends.views)}
        />
        <StatCard
          icon={MousePointer}
          label={t("cards.clicks")}
          value={formatNumber(analytics?.totalClicks || 0)}
          tone="warning"
          trend={renderTrendBadge(trends.clicks)}
        />
      </div>

      {/* Top Content Types */}
      <section
        aria-labelledby="ax-top-content"
        className="overflow-hidden rounded-xl border border-ax-edge bg-ax-surface shadow-ax-sm"
      >
        <div className="border-b border-ax-edge px-5 py-4">
          <h2
            id="ax-top-content"
            className="text-base font-semibold text-ax-primary"
          >
            {t("topContent")}
          </h2>
        </div>
        <div className="p-4 sm:p-5">
          {analytics?.topContentTypes && analytics.topContentTypes.length > 0 ? (
            <div className="space-y-2.5">
              {analytics.topContentTypes.map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ax-edge bg-ax-surface-inset px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ax-accent-soft text-xs font-bold text-ax-accent">
                      {formatNumber(index + 1)}
                    </span>
                    <div className="min-w-0 text-sm font-medium text-ax-primary">
                      <span className="truncate">{item.type}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-ax-accent-soft px-3 py-0.5 text-xs font-semibold tabular-nums text-ax-accent">
                    {formatNumber(item.count)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ax-muted">
              {t("noData")}
            </p>
          )}
        </div>
      </section>

      {/* Recent Activity */}
      <section
        aria-labelledby="ax-recent-analytics"
        className="overflow-hidden rounded-xl border border-ax-edge bg-ax-surface shadow-ax-sm"
      >
        <div className="border-b border-ax-edge px-5 py-4">
          <h2
            id="ax-recent-analytics"
            className="text-base font-semibold text-ax-primary"
          >
            {t("recentActivity")}
          </h2>
        </div>
        <div className="p-4 sm:p-5">
          {analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
            <div className="space-y-2.5">
              {analytics.recentActivity.map((activity, index) => (
                <div
                  key={`${activity.created_at}-${index}`}
                  className="flex flex-col gap-2 rounded-lg border border-ax-edge bg-ax-surface-inset px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          actionBadgeClass(activity.action),
                        )}
                      >
                        {getActionLabel(activity.action)}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-ax-edge bg-ax-surface px-2.5 py-0.5 text-xs font-medium text-ax-secondary">
                        {getContentLabel(activity.content_type)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ax-muted">
                      {activity.action} / {activity.content_type}
                    </p>
                  </div>

                  <div className="shrink-0 text-start text-xs tabular-nums text-ax-muted sm:text-end">
                    {formatDateTime(activity.created_at)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-ax-muted">
              {t("noRecentActivity")}
            </p>
          )}
        </div>
      </section>

    </div>
  );
};
