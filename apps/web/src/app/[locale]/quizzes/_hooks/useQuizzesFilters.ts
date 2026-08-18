import { useMemo, useState } from "react";
import { useSubjects } from "@/hooks/useSubjects";
import type { Quiz } from "@/types/database";

type QuizWithMeta = {
  quiz: Quiz;
  meta: {
    subject: string;
    department: string;
    year: string;
    semester: string;
    descriptionText: string;
  };
};

type FiltersState = {
  search: string;
  subject: string;
  department: string;
  year: string;
  semester: string;
};

const getLevelNumber = (level: unknown): number | null => {
  if (!level || typeof level !== "object") return null;
  const raw = (level as Record<string, unknown>).level_number;
  return typeof raw === "number" ? raw : null;
};

export function useQuizzesFilters(args: {
  quizzes: Quiz[];
  allSubjects: { name: string }[];
  subjectsLoading: boolean;
  academicLevels: { name?: string | null }[];
  getDepartmentsForLevelName: (levelName: string) => { name: string }[];
  user: unknown;
}) {
  const {
    quizzes,
    allSubjects,
    subjectsLoading,
    academicLevels,
    getDepartmentsForLevelName,
    user,
  } = args;

  const [filters, setFilters] = useState<FiltersState>({
    search: "",
    subject: "",
    department: "",
    year: "",
    semester: "",
  });

  const quizzesWithMeta = useMemo((): QuizWithMeta[] => {
    return quizzes.map((quiz: Quiz) => {
      const quizRecord = quiz as unknown as Record<string, unknown>;
      let subject =
        typeof quizRecord.subject === "string" ? quizRecord.subject : "";
      let department =
        typeof quizRecord.department === "string" ? quizRecord.department : "";
      let year = typeof quizRecord.year === "string" ? quizRecord.year : "";
      let semester = "";
      let parsedDescription = "";

      try {
        const parsed = JSON.parse(quiz.description || "{}");
        if (typeof parsed === "object" && parsed !== null) {
          const obj = parsed as Record<string, unknown>;
          if (!subject && typeof obj.subject === "string") subject = obj.subject;
          if (!department && typeof obj.department === "string")
            department = obj.department;
          if (!year && typeof obj.year === "string") year = obj.year;
          if (semester === "") {
            const sem = obj.semester;
            if (typeof sem === "number" || typeof sem === "string") {
              const n = Number(sem);
              if (Number.isFinite(n) && (n === 1 || n === 2)) {
                semester = String(n);
              }
            }
          }
          if (typeof obj.description === "string")
            parsedDescription = obj.description;
        }
      } catch {
        // ignore
      }

      return {
        quiz,
        meta: {
          subject: (subject || "").toString(),
          department: (department || "").toString(),
          year: (year || "").toString(),
          semester: (semester || "").toString(),
          descriptionText: (parsedDescription || "").toString(),
        },
      };
    });
  }, [quizzes]);

  const selectedLevelNumber = useMemo(() => {
    if (!filters.year) return null;
    const found = academicLevels.find((l) => l.name === filters.year);
    return getLevelNumber(found);
  }, [academicLevels, filters.year]);

  const selectedSemesterNumber = useMemo(() => {
    if (!filters.year) return undefined;
    if (!filters.semester) return null;
    const n = Number(filters.semester);
    return Number.isFinite(n) ? n : null;
  }, [filters.semester, filters.year]);

  const { subjects: filteredSubjectsForFilters } = useSubjects({
    level: filters.year ? selectedLevelNumber : undefined,
    semester: selectedSemesterNumber,
  });

  const filterOptions = useMemo(() => {
    const subjects = new Set<string>();
    const departments = new Set<string>();
    const years = new Set<string>();
    const semesters = new Set<string>();

    quizzesWithMeta.forEach(({ meta }: QuizWithMeta) => {
      if (meta.subject) subjects.add(meta.subject);
      if (meta.department) departments.add(meta.department);
      if (meta.year) years.add(meta.year);
      if (meta.semester) semesters.add(meta.semester);
    });

    const subjectList = subjectsLoading
      ? Array.from(subjects).sort((a, b) => a.localeCompare(b, "ar"))
      : (filters.year ? filteredSubjectsForFilters : allSubjects)
          .map((s) => s.name)
          .sort((a, b) => a.localeCompare(b, "ar"));

    const derivedYears = Array.from(years)
      .map((v) => (v || "").trim())
      .filter(Boolean)
      .filter((v) => !/^\d+$/.test(v))
      .sort((a, b) => a.localeCompare(b, "ar"));

    const academicLevelNames = academicLevels
      .map((l) => (l.name || "").trim())
      .filter(Boolean);

    const yearOptions =
      academicLevelNames.length > 0 ? academicLevelNames : derivedYears;
    const departmentsForSelectedYear = filters.year
      ? getDepartmentsForLevelName(filters.year).map((d) => d.name)
      : [];

    const deptOptions = filters.year ? departmentsForSelectedYear : [];

    const semesterOptions = ["1", "2"].filter((v) => {
      if (!filters.year) return true;
      if (semesters.size === 0) return true;
      return semesters.has(v);
    });

    return {
      subjects: subjectList,
      departments: filters.year ? deptOptions : [],
      years: yearOptions,
      semesters: semesterOptions,
    };
  }, [
    quizzesWithMeta,
    allSubjects,
    filteredSubjectsForFilters,
    subjectsLoading,
    academicLevels,
    filters.year,
    getDepartmentsForLevelName,
  ]);

  const filteredQuizzes = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    const allowedSubjects = user
      ? null
      : new Set(
          allSubjects.map((sub) => (sub.name || "").trim()).filter(Boolean),
        );

    return quizzesWithMeta
      .filter(({ quiz, meta }: QuizWithMeta) => {
        if (
          allowedSubjects &&
          meta.subject &&
          !allowedSubjects.has(meta.subject.trim())
        )
          return false;

        if (filters.subject && meta.subject !== filters.subject) return false;
        if (filters.department && meta.department !== filters.department)
          return false;
        if (filters.year && meta.year !== filters.year) return false;
        if (filters.semester && meta.semester !== filters.semester) return false;

        if (!s) return true;

        const title = (quiz.title || "").toLowerCase();
        const rawDesc = (quiz.description || "").toLowerCase();
        const parsedDesc = (meta.descriptionText || "").toLowerCase();

        return title.includes(s) || rawDesc.includes(s) || parsedDesc.includes(s);
      })
      .map(({ quiz }: QuizWithMeta) => quiz);
  }, [
    allSubjects,
    filters.department,
    filters.search,
    filters.semester,
    filters.subject,
    filters.year,
    quizzesWithMeta,
    user,
  ]);

  return {
    filters,
    setFilters,
    quizzesWithMeta,
    filterOptions,
    filteredQuizzes,
  };
}
