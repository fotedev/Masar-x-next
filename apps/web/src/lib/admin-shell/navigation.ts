/**
 * Admin shell navigation model (Aurora Admin port).
 *
 * Groups map 1:1 to the legacy admin-dashboard tabs so no feature is
 * dropped: every tab id here is consumed by admin-dashboard/page.tsx.
 * Labels resolve via next-intl keys (adminDashboard.tabs.*) in the
 * components — this file stays locale-agnostic by design (house rule I3).
 */
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  LayoutDashboard,
  BookOpen,
  CreditCard,
  Flag,
  GraduationCap,
  Layout,
  Newspaper,
  School,
} from "lucide-react";

export type AdminTabId =
  | "overview"
  | "courses"
  | "subjects"
  | "enrollments"
  | "summaries"
  | "news"
  | "appeals"
  | "quizzes"
  | "analytics"
  | "page_management";

export interface AdminNavItem {
  id: AdminTabId;
  /** next-intl key under the adminDashboard namespace, e.g. "tabs.courses". */
  labelKey: string;
  icon: LucideIcon;
  /** Legacy role gate (doctor-only tabs), mirrors AdminDashboardTabs. */
  doctorOnly: boolean;
  /** Badge definition — counts are supplied at render time by the page. */
  badge?: { tone: "info" | "success" | "warning" | "danger"; dot?: true };
}

export interface AdminNavGroup {
  id: string;
  /** next-intl key under the adminDashboard namespace, e.g. "groups.core". */
  labelKey: string;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "content",
    labelKey: "groups.content",
    items: [
      { id: "overview", labelKey: "tabs.overview", icon: LayoutDashboard, doctorOnly: false },
      { id: "summaries", labelKey: "tabs.summaries", icon: BookOpen, doctorOnly: false },
      { id: "news", labelKey: "tabs.news", icon: Newspaper, doctorOnly: false },
      { id: "appeals", labelKey: "tabs.appeals", icon: Flag, doctorOnly: false, badge: { tone: "info" } },
    ],
  },
  {
    id: "learning",
    labelKey: "groups.learning",
    items: [
      { id: "courses", labelKey: "tabs.courses", icon: GraduationCap, doctorOnly: true },
      { id: "subjects", labelKey: "tabs.subjects", icon: School, doctorOnly: false },
      { id: "quizzes", labelKey: "tabs.quizzes", icon: BookOpen, doctorOnly: false },
      { id: "enrollments", labelKey: "tabs.enrollments", icon: CreditCard, doctorOnly: true },
    ],
  },
  {
    id: "insights",
    labelKey: "groups.insights",
    items: [
      { id: "analytics", labelKey: "tabs.analytics", icon: BarChart3, doctorOnly: false },
    ],
  },
  {
    id: "system",
    labelKey: "groups.system",
    items: [
      { id: "page_management", labelKey: "tabs.pageManagement", icon: Layout, doctorOnly: true },
    ],
  },
];

export const allGroupIds: string[] = adminNavGroups.map((g) => g.id);
