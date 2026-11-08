-- Quiz column grants — spec 040 PR-3 (part 2 of the quiz-integrity fix).
-- correct_answer leaves every anon/authenticated SELECT: the key never
-- reaches any browser surface (RSC payload, client getQuiz, admin form —
-- the admin form reads through admin_list_quiz_questions, landed in PR-1).
-- `explanation` stays readable; it is displayed only in post-finish flows.
-- Admin INSERT/UPDATE of the key (quiz authoring) is unaffected.

REVOKE SELECT ON public.quiz_questions FROM anon, authenticated;
GRANT SELECT (id, quiz_id, question, options, explanation, order_index, image_url)
  ON public.quiz_questions TO anon, authenticated;
