import { type FC } from "react";

import { 
  GraduationCap, 
  School, 
  CreditCard, 
  BookOpen, 
  Newspaper, 
  Flag, 
  BarChart3, 
  Layout 
} from "lucide-react";
import { useTranslations } from "next-intl";

interface AdminDashboardTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminRole: string | null;
}

export const AdminDashboardTabs: FC<AdminDashboardTabsProps> = ({
  activeTab,
  setActiveTab,
  adminRole,
}) => {
  const t = useTranslations("adminDashboard");

  const tabs = [
    {
      id: "courses",
      icon: GraduationCap,
      label: t("tabs.courses"),
      color: "green",
      doctorOnly: true,
    },
    {
      id: "subjects",
      icon: School,
      label: t("tabs.subjects"),
      color: "indigo",
      doctorOnly: false,
    },
    {
      id: "enrollments",
      icon: CreditCard,
      label: t("tabs.enrollments"),
      color: "blue",
      doctorOnly: true,
    },
    {
      id: "summaries",
      icon: BookOpen,
      label: t("tabs.summaries"),
      color: "blue",
      doctorOnly: false,
    },
    {
      id: "news",
      icon: Newspaper,
      label: t("tabs.news"),
      color: "blue",
      doctorOnly: false,
    },
    {
      id: "appeals",
      icon: Flag,
      label: t("tabs.appeals"),
      color: "orange",
      doctorOnly: false,
    },
    {
      id: "quizzes",
      icon: BookOpen,
      label: t("tabs.quizzes"),
      color: "purple",
      doctorOnly: false,
    },
    {
      id: "analytics",
      icon: BarChart3,
      label: t("tabs.analytics"),
      color: "green",
      doctorOnly: false,
    },
    {
      id: "page_management",
      icon: Layout,
      label: t("tabs.pageManagement"),
      color: "blue",
      doctorOnly: true,
    },
  ];

  return (
    <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        if (tab.doctorOnly && adminRole !== "doctor") return null;

        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        const colorClasses: Record<string, string> = {
          green: isActive ? "border-green-500 text-green-600 dark:text-green-400" : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
          indigo: isActive ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
          blue: isActive ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
          orange: isActive ? "border-orange-500 text-orange-600 dark:text-orange-400" : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
          purple: isActive ? "border-purple-500 text-purple-600 dark:text-purple-400" : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
        };

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${colorClasses[tab.color]}`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
