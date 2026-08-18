import { type FC, type ChangeEvent, useState, useEffect } from "react";
import { Loader2, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/Button";
import { Textarea } from "./ui/Textarea";
import { useCourses } from "../hooks/useCourses";
import { toast } from "sonner";
import { CourseInsert } from "@/types/database";

interface AddCourseModalProps {
  showAddCourse: boolean;
  editingCourse: {
    id: string;
    title?: string | null;
    description?: string | null;
    price?: number | null;
    is_academic?: boolean | null;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

export const AddCourseModal: FC<AddCourseModalProps> = ({
  showAddCourse,
  editingCourse,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const { addCourse, updateCourse } = useCourses();
  const tCourses = useTranslations("courses");
  const tAi = useTranslations("aiAssistant");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [isAcademic, setIsAcademic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingCourse) {
      setTitle(editingCourse.title || "");
      setDescription(editingCourse.description || "");
      setPrice(editingCourse.price?.toString() || "");
      setIsAcademic(editingCourse.is_academic ?? true);
    } else {
      setTitle("");
      setDescription("");
      setPrice("");
      setIsAcademic(true);
    }
  }, [editingCourse, showAddCourse]);

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error(tCourses("incompleteDataTitle"), {
        description: tCourses("incompleteDataDesc"),
      });
      return;
    }

    try {
      setSaving(true);

      if (!user) return;

      const courseData: CourseInsert = {
        title: title.trim(),
        description: description.trim(),
        price: price ? parseFloat(price) : 0,
        is_academic: isAcademic,
        is_published: false,
        instructor_id: user.id,
      };

      if (editingCourse) {
        await updateCourse(editingCourse.id, courseData);
      } else {
        await addCourse(courseData);
      }

      onSave();
      onClose();
    } catch {
      // toast is handled in useCourses
    } finally {
      setSaving(false);
    }
  };

  if (!showAddCourse) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingCourse ? tCourses("editCourseHeading") : tCourses("createCourseHeading")}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label={tAi("close")}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label 
                htmlFor="course-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {tCourses("courseTitleLabel")}
              </label>
              <input
                id="course-title"
                name="title"
                type="text"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder={tCourses("courseTitlePlaceholder")}
                required
              />
            </div>

            <div>
              <label 
                htmlFor="course-description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {tCourses("courseDescriptionLabel")}
              </label>
              <Textarea
                id="course-description"
                name="description"
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                className="w-full"
                rows={4}
                placeholder={tCourses("courseDescriptionPlaceholder")}
                required
              />
            </div>

            <div>
              <label 
                htmlFor="course-price"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {tCourses("coursePriceLabel")}
              </label>
              <input
                id="course-price"
                name="price"
                type="number"
                value={price}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder={tCourses("coursePricePlaceholder")}
                min="0"
                step="0.01"
                aria-describedby="course-price-helper"
              />
              <p 
                id="course-price-helper"
                className="text-xs text-gray-500 dark:text-gray-400 mt-1"
              >
                {tCourses("coursePriceHelper")}
              </p>
            </div>

            <div className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                id="is_academic_course"
                name="is_academic"
                checked={isAcademic}
                onChange={(e) => setIsAcademic(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="is_academic_course"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {tCourses("academicCourseLabel")}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {tCourses("savingInProgress")}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingCourse ? tCourses("update") : tCourses("create")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
