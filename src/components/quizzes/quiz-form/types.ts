export type AcademicLevelOption = { id: string; name: string };
export type DepartmentOption = { id: string; name: string };
export type SubjectOption = { id: string; name: string };
export type SummaryOption = { id: string; title: string };

export type QuizQuestion = {
  type: "multiple-choice" | "true-false";
  question: string;
  imageUrl: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export type QuizFormData = {
  title: string;
  durationMinutes: string;
  year: string;
  semester: string;
  department: string;
  subject: string;
  summaryId: string;
  description: string;
  questions: QuizQuestion[];
};
