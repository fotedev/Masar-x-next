import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";

interface Lecture {
  id: string;
  lecture_key: string;
  lecture_label: string;
  subject: string;
}

interface LectureSelectProps {
  subject: string;
  selectedKey: string;
  onSelect: (lecture: Lecture | null) => void;
  error?: string;
  label?: string;
}

export function LectureSelect({
  subject,
  selectedKey,
  onSelect,
  error,
  label,
}: LectureSelectProps) {
  const t = useTranslations("lectureSelect");
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (subject) {
      fetchLectures();
    }
  }, [subject]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchLectures() {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("subject_lectures")
        .select("id, lecture_key, lecture_label, subject")
        .eq("subject", subject)
        .order("order_index", { ascending: true });

      if (fetchError) throw fetchError;
      setLectures(data || []);
    } catch (err) {
      console.error("Error fetching lectures for select:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredLectures = lectures.filter(
    (l) =>
      l.lecture_label.toLowerCase().includes(search.toLowerCase()) ||
      l.lecture_key.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedLecture = lectures.find((l) => l.lecture_key === selectedKey);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all ${
          error
            ? "border-red-500 ring-1 ring-red-500"
            : "border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        }`}
      >
        <span className="truncate">
          {selectedLecture ? selectedLecture.lecture_label : t("label")}
        </span>
        <ChevronsUpDown className="w-4 h-4 text-gray-500 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 border-none rounded-md focus:ring-1 focus:ring-blue-500 dark:text-white"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto mb-2"></div>
                {t("loading")}
              </div>
            ) : filteredLectures.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-gray-500">
                {t("noResults")}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(null);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <span>{t("none")}</span>
                  {selectedKey === "" && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </button>
                {filteredLectures.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      onSelect(l);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors text-right"
                  >
                    <div className="flex flex-col items-start text-right">
                      <span className="font-medium">{l.lecture_label}</span>
                      <span className="text-xs text-gray-500">
                        {l.lecture_key}
                      </span>
                    </div>
                    {selectedKey === l.lecture_key && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
