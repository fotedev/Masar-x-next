import { useState, useMemo, useEffect } from "react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { SummaryWithRatings, AdminNews, AdminQuiz, Appeal } from "@/types/database";

interface UseAdminFiltersProps {
  summaries: SummaryWithRatings[];
  news: AdminNews[];
  quizzes: AdminQuiz[];
  appeals: Appeal[];
}

export function useAdminFilters({ summaries, news, quizzes, appeals }: UseAdminFiltersProps) {
  const { activeSemester } = usePlatformSettings();
  const { levels, getDepartmentsForLevelName } = useAcademicOptions();

  const [globalFilters, setGlobalFilters] = useState({
    subject: "",
    department: "",
    year: "",
  });

  const availableDepartments = useMemo(() => {
    if (!globalFilters.year) return [];
    return getDepartmentsForLevelName(globalFilters.year);
  }, [getDepartmentsForLevelName, globalFilters.year]);

  useEffect(() => {
    if (globalFilters.year || !activeSemester) return;
    const idx = activeSemester - 1;
    const defaultLevel = levels[idx]?.name;
    if (defaultLevel) {
      setGlobalFilters((prev) => ({ ...prev, year: defaultLevel }));
    }
  }, [activeSemester, globalFilters.year, levels]);

  const filteredSummaries = useMemo(() => {
    return summaries.filter((s) => {
      const matchSubject = !globalFilters.subject || s.subject === globalFilters.subject;
      const matchDepartment = !globalFilters.department || s.department === globalFilters.department;
      const matchYear = !globalFilters.year || s.year === globalFilters.year;
      return matchSubject && matchDepartment && matchYear;
    });
  }, [summaries, globalFilters]);

  const filteredNews = useMemo(() => {
    return news.filter((n) => {
      const matchSubject = !globalFilters.subject || n.subject === globalFilters.subject;
      const matchDepartment = !globalFilters.department || n.department === globalFilters.department;
      const matchYear = !globalFilters.year || n.year === globalFilters.year;
      return matchSubject && matchDepartment && matchYear;
    });
  }, [news, globalFilters]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      const matchSubject = !globalFilters.subject || q.subject === globalFilters.subject;
      const matchDepartment = !globalFilters.department || q.department === globalFilters.department;
      const matchYear = !globalFilters.year || q.year === globalFilters.year;
      return matchSubject && matchDepartment && matchYear;
    });
  }, [quizzes, globalFilters]);

  const filteredAppeals = useMemo(() => {
    return appeals.filter((a) => {
      let content: {
        subject?: string | null;
        department?: string | null;
        year?: string | null;
      } | null = null;

      if (a.content_type === "summary") {
        content = summaries.find((s) => s.id === a.content_id) || null;
      } else if (a.content_type === "news") {
        const foundNews = news.find((n) => n.id === a.content_id);
        content = foundNews ? {
          subject: foundNews.subject,
          department: foundNews.department,
          year: foundNews.year,
        } : null;
      }

      if (content) {
        const matchSubject = !globalFilters.subject || content.subject === globalFilters.subject;
        const matchDepartment = !globalFilters.department || content.department === globalFilters.department;
        const matchYear = !globalFilters.year || content.year === globalFilters.year;
        return matchSubject && matchDepartment && matchYear;
      }

      return !globalFilters.subject && !globalFilters.department && !globalFilters.year;
    });
  }, [appeals, summaries, news, globalFilters]);

  const clearFilters = () => setGlobalFilters({ subject: "", department: "", year: "" });

  return {
    globalFilters,
    setGlobalFilters,
    availableDepartments,
    filteredSummaries,
    filteredNews,
    filteredQuizzes,
    filteredAppeals,
    clearFilters,
    levels
  };
}
