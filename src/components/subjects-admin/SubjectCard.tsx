import React from "react";
import {
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  GraduationCap,
  BookOpen as BookOpenIcon,
} from "lucide-react";
import { Subject } from "../../types/database";
import { SUBJECT_ICONS } from "../../constants/subjects";

interface SubjectCardProps {
  subject: Subject;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  onEdit: (subject: Subject) => void;
  onDelete: (id: string) => void;
  onManageLectures: (subject: Subject) => void;
  onUpdateStatus: (id: string, status: "approved" | "rejected") => void;
}

export function SubjectCard({
  subject,
  t,
  onEdit,
  onDelete,
  onManageLectures,
  onUpdateStatus,
}: SubjectCardProps) {
  const IconComponent = SUBJECT_ICONS[subject.name] || BookOpenIcon;

  return (
    <div className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 hover:border-blue-500/50 hover:shadow-xl transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div
          className={`p-3 rounded-2xl ${
            subject.status === "approved"
              ? "bg-green-100 text-green-600 dark:bg-green-900/30"
              : subject.status === "rejected"
                ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30"
          }`}
        >
          <IconComponent className="w-6 h-6" />
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(subject)}
            className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(subject.id)}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
        {subject.name}
      </h3>
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <GraduationCap className="w-4 h-4" />
        {(() => {
          const profName = subject.professor || "";
          if (!profName) return t("professorUnknown");
          const hasTitle = /^(Dr\.|Prof\.|د\.|أ\.د)/i.test(profName);
          if (hasTitle) return profName;

          const label = subject.professor_gender === "female"
            ? t("professorLabelFemale")
            : t("professorLabelMale");

          const finalLabel = label.startsWith("subjectsTab.") ? (subject.professor_gender === "female" ? "دكتورة" : "دكتور") : label;

          return `${finalLabel} ${profName}`;
        })()}
      </div>

      <button
        onClick={() => onManageLectures(subject)}
        className="w-full mb-4 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition-all text-sm border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
      >
        <BookOpenIcon className="w-4 h-4" />
        {t("manageLectures")}
      </button>

      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
        {subject.description || t("noDescription")}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
        <div className="flex gap-2">
          <span className="text-xs font-bold px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {t("levelLabel", {
              level: subject.level ?? 0,
            })}
          </span>
          <span className="text-xs font-bold px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {t("semesterLabel", {
              semester: subject.semester ?? 0,
            })}
          </span>
        </div>

        {subject.status === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateStatus(subject.id, "approved")}
              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-all"
              title={t("approve")}
            >
              <CheckCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => onUpdateStatus(subject.id, "rejected")}
              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all"
              title={t("reject")}
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
