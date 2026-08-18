import type { Dispatch, SetStateAction } from "react";

export type LevelOption = {
  id: string;
  name: string;
  is_active?: boolean;
};

export type DepartmentOption = {
  id: string;
  name: string;
  is_active?: boolean;
};

export type ExamQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export type ExamFormData = {
  title: string;
  description: string;
  durationMinutes: string;
  department: string;
  year: string;
  questions: ExamQuestion[];
};

export type SetExamFormData = Dispatch<SetStateAction<ExamFormData>>;
