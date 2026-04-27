import { type FormEvent } from "react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useAcademicOptions } from "../hooks/useAcademicOptions";
import { useTranslations } from "next-intl";

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const { user } = useAuth();
  const t = useTranslations("onboarding");
  const { levels, getDepartmentsForLevelName } = useAcademicOptions();
  const [formData, setFormData] = useState({
    academic_level: "",
    department: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const availableDepartments = useMemo(() => {
    if (!formData.academic_level) return [];
    return getDepartmentsForLevelName(formData.academic_level);
  }, [formData.academic_level, getDepartmentsForLevelName]);

  useEffect(() => {
    if (isOpen && user) {
      // Check if user has completed onboarding
      const academicLevel = user.user_metadata?.academic_level;
      const department = user.user_metadata?.department;

      if (academicLevel) {
        setFormData((prev) => ({ ...prev, academic_level: academicLevel }));
      }
      if (department) {
        setFormData((prev) => ({ ...prev, department: department }));
      }
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!formData.academic_level) {
      if (formData.department) {
        setFormData((prev) => ({ ...prev, department: "" }));
      }
      return;
    }

    if (formData.department) {
      const exists = availableDepartments.some(
        (d) => d.name === formData.department,
      );
      if (!exists) {
        setFormData((prev) => ({ ...prev, department: "" }));
      }
    }
  }, [formData.academic_level, formData.department, availableDepartments]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const selectedLevel = levels.find(
        (l) => l.name === formData.academic_level,
      );
      const selectedDepartment = availableDepartments.find(
        (d) => d.name === formData.department,
      );

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        level: selectedLevel?.level_number ?? null,
        department_id: selectedDepartment?.id ?? null,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      await supabase.auth.refreshSession();

      onComplete();
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t("welcome")}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{t("subtitle")}</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("academicLevel")} <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.academic_level}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    academic_level: e.target.value,
                    department: "",
                  })
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t("selectLevel")}</option>
                {levels.map((level) => (
                  <option
                    key={level.id}
                    value={level.name}
                    disabled={!level.is_active}
                  >
                    {level.name} {!level.is_active && `(${t("comingSoon")})`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t("otherLevelsNotice")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("department")} <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.department}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                disabled={
                  !formData.academic_level || availableDepartments.length === 0
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t("selectDepartment")}</option>
                {availableDepartments.map((dept) => (
                  <option
                    key={dept.id}
                    value={dept.name}
                    disabled={!dept.is_active}
                  >
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-3 rounded-lg font-medium focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{t("saving")}</span>
                </>
              ) : (
                <span>{t("continue")}</span>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("changeLaterNotice")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
