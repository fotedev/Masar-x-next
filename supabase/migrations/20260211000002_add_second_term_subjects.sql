/*
  Add second term subjects
*/

INSERT INTO subjects (name, semester) VALUES
  ('رياضيات 2', 2),
  ('التواصل الشخصي', 2),
  ('أساسيات نظم المعلومات', 2),
  ('الحاسبات والمجتمع', 2),
  ('أساسيات البرمجة', 2),
  ('الكتابة التقنية للحوسبة', 2),
  ('دوائر رقمية', 2)
ON CONFLICT (name) DO NOTHING;
