import {
  BookOpen,
  Brain,
  CalendarDays,
  Download,
  FolderOpen,
  Globe,
  GraduationCap,
  Home,
  Newspaper,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon per nav item key — shared by the desktop rail (SideNav) and the
 * mobile drawer (MobileNav), so both surfaces always stay in sync.
 */
export const NAV_ICONS: Record<string, LucideIcon> = {
  home: Home,
  news: Newspaper,
  subjects: BookOpen,
  materials: FolderOpen,
  schedules: CalendarDays,
  courses: GraduationCap,
  quizzes: Brain,
  assistant: Sparkles,
  downloads: Download,
  "non-academic": Globe,
};
