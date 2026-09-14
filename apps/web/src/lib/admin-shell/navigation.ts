/**
 * Admin shell navigation model.
 *
 * IA (spec 006, user-ratified tree):
 *   Overview & Analytics  -> overview
 *   Academic Content      -> subjects, courses_enrollments (doctor), quizzes, news
 *   Moderation & System   -> appeals, page_management (doctor), zane (placeholder)
 *
 * The Summaries destination is retired: admin no longer manages summaries
 * (spec 006 footprint table); content lives inside subjects/lectures.
 *
 * Views are driven by component state (activeTab in
 * app/[locale]/admin-dashboard/page.tsx), not URLs — items are buttons, not
 * links. Labels resolve via next-intl keys (adminDashboard.tabs.*) in the
 * components — this file stays locale-agnostic by design (house rule I3).
 */
import type { LucideIcon } from "lucide-react";
import {
  HelpCircle,
  LayoutDashboard,
  Sparkles,
  Flag,
  GraduationCap,
  Layout,
  Newspaper,
  School,
} from "lucide-react";

export type AdminTabId =
  | "overview"
  | "subjects"
  | "courses_enrollments"
  | "quizzes"
  | "news"
  | "appeals"
  | "page_management"
  /** Placeholder entry — rendered disabled, has no view. */
  | "zane";

export interface AdminNavItem {
  id: AdminTabId;
  /** next-intl key under the adminDashboard namespace, e.g. "tabs.courses". */
  labelKey: string;
  icon: LucideIcon;
  /** Legacy role gate (doctor-only items), mirrors the retired AdminDashboardTabs. */
  doctorOnly: boolean;
  /** Disabled entries render inert (roadmap features) and are excluded from the command palette. */
  disabled?: boolean;
  /** next-intl key for the static chip shown on disabled entries, e.g. "tabs.zaneSoon". */
  soonLabelKey?: string;
  /** Badge definition — counts are supplied at render time by the page. */
  badge?: { tone: "info" | "success" | "warning" | "danger"; dot?: true };
}

export interface AdminNavGroup {
  id: string;
  /** next-intl key under the adminDashboard namespace, e.g. "groups.content". */
  labelKey: string;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    id: "insights",
    labelKey: "groups.insights",
    items: [
      { id: "overview", labelKey: "tabs.overview", icon: LayoutDashboard, doctorOnly: false },
    ],
  },
  {
    id: "content",
    labelKey: "groups.content",
    items: [
      { id: "subjects", labelKey: "tabs.subjects", icon: School, doctorOnly: false },
      {
        id: "courses_enrollments",
        labelKey: "tabs.coursesEnrollments",
        icon: GraduationCap,
        doctorOnly: true,
      },
      { id: "quizzes", labelKey: "tabs.quizzes", icon: HelpCircle, doctorOnly: false },
      { id: "news", labelKey: "tabs.news", icon: Newspaper, doctorOnly: false },
    ],
  },
  {
    id: "system",
    labelKey: "groups.system",
    items: [
      { id: "appeals", labelKey: "tabs.appeals", icon: Flag, doctorOnly: false, badge: { tone: "info" } },
      { id: "page_management", labelKey: "tabs.pageManagement", icon: Layout, doctorOnly: true },
      {
        id: "zane",
        labelKey: "tabs.zane",
        icon: Sparkles,
        doctorOnly: false,
        disabled: true,
        soonLabelKey: "tabs.zaneSoon",
      },
    ],
  },
];

export const allGroupIds: string[] = adminNavGroups.map((g) => g.id);
