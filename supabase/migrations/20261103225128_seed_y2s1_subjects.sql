-- Spec 033 — register the four Y2-S1 subjects the real exams belong to.
-- Without these rows the anonymous quizzes filter (allowedSubjects over
-- subjects.name) hides every seeded exam, and the subject dropdown cannot
-- list them. Data-only; idempotent on the subjects_name_key unique constraint.
INSERT INTO public.subjects (name, name_en, level, semester, is_academic, show_on_home, status)
VALUES
  ('اتصالات البيانات', 'Data Communication', 2, 1, true, true, 'approved'),
  ('التركيبات المنفصلة', 'Discrete Structures', 2, 1, true, true, 'approved'),
  ('البرمجة الكائنية', 'OOP', 2, 1, true, true, 'approved'),
  ('الإشارات والأنظمة', 'Signals & Systems', 2, 1, true, true, 'approved')
ON CONFLICT (name) DO NOTHING;
