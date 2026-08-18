import { useMemo } from "react";
import { CourseWithInstructor } from "@/types/database";

interface UseCoursesFilterProps {
  courses: CourseWithInstructor[];
  searchTerm: string;
  filter: "all" | "free" | "paid";
}

export function useCoursesFilter({ courses, searchTerm, filter }: UseCoursesFilterProps) {
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const instructorName = course.instructor_name || "";
      const matchesSearch =
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        instructorName.toLowerCase().includes(searchTerm.toLowerCase());

      const price = typeof course.price === "number" ? course.price : Number(course.price);
      const safePrice = Number.isFinite(price) ? price : 0;

      const matchesFilter =
        filter === "all" ||
        (filter === "free" && safePrice <= 0) ||
        (filter === "paid" && safePrice > 0);

      return matchesSearch && matchesFilter;
    });
  }, [courses, searchTerm, filter]);

  const stats = useMemo(() => {
    const total = courses.length;
    const free = courses.filter((c) => {
      const price = typeof c.price === "number" ? c.price : Number(c.price);
      return Number.isFinite(price) && price <= 0;
    }).length;
    const totalStudents = courses.reduce((sum, c) => sum + (c.total_students || 0), 0);

    return {
      total,
      free,
      totalStudents,
    };
  }, [courses]);

  return {
    filteredCourses,
    stats,
  };
}
