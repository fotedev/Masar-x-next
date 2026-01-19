export const ACADEMIC_LEVELS = [
    "المستوى الأول",
    "المستوى الثاني",
    "المستوى الثالث",
    "المستوى الرابع",
] as const;

export const DEPARTMENTS = [
    "قسم الذكاء الإصطناعي ☝",
    "قسم هندسة البرمجيات",
    "قسم علوم الحاسب",
    "قسم نظم المعلومات",
] as const;

export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];
export type Department = (typeof DEPARTMENTS)[number];
