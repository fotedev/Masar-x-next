#!/usr/bin/env node
/**
 * MVP launch content seed — MasarX
 *
 * Creates/updates three Term-1 subjects (programming, mathematics, computers),
 * two lectures each (real YouTube explainers + sample file links), and a demo
 * 3-question quiz on the programming subject.
 *
 * Runs against Supabase with the SERVICE ROLE key (bypasses RLS for seeding) and
 * speaks the REST API directly, so it needs no extra dependencies.
 *
 *   pnpm seed:launch            # write to the database
 *   pnpm seed:launch --dry-run  # probe schema + print planned writes, no writes
 *
 * The key is read from .env (SUPABASE_SERVICE_ROLE_KEY) or the environment. It is
 * never printed and never written to the repo.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY_RUN = process.argv.includes("--dry-run");

function loadEnv() {
  const env = { ...process.env };
  for (const file of [".env", ".env.local"]) {
    try {
      const raw = readFileSync(path.join(ROOT, file), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      /* file optional */
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[seed] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env). Aborting.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(table, { method = "GET", query = "", body, prefer } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}`;
  const res = await fetch(url, {
    method,
    headers: prefer ? { ...headers, Prefer: prefer } : headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    throw new Error(`${method} ${table} -> HTTP ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

/** Column names of a table, derived from a live row when possible. */
async function tableColumns(table, fallback) {
  try {
    const rows = await rest(table, { query: "select=*&limit=1" });
    if (Array.isArray(rows) && rows.length > 0) return Object.keys(rows[0]);
  } catch (e) {
    console.warn(`[seed] probe ${table} failed: ${e.message}`);
  }
  return fallback;
}

function filterPayload(payload, columns, table) {
  const out = {};
  const dropped = [];
  for (const [k, v] of Object.entries(payload)) {
    if (columns.includes(k)) out[k] = v;
    else dropped.push(k);
  }
  if (dropped.length) console.warn(`[seed] ${table}: dropping non-existent columns -> ${dropped.join(", ")}`);
  return out;
}

async function findOne(table, filterQuery) {
  const rows = await rest(table, { query: `select=*&${filterQuery}&limit=1` });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsert(table, payload, onConflict) {
  if (DRY_RUN) {
    console.log(`[seed][dry-run] UPSERT ${table} on_conflict=${onConflict} :: ${JSON.stringify(payload)}`);
    return payload;
  }
  const rows = await rest(table, {
    method: "POST",
    query: `on_conflict=${encodeURIComponent(onConflict)}`,
    body: [payload],
    prefer: "return=representation,resolution=merge-duplicates",
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function ensure(table, filterQuery, payload) {
  const existing = await findOne(table, filterQuery);
  if (existing) {
    console.log(`[seed] ${table}: exists (${filterQuery}) — skipping`);
    return existing;
  }
  if (DRY_RUN) {
    console.log(`[seed][dry-run] INSERT ${table} :: ${JSON.stringify(payload)}`);
    return { ...payload, id: "<dry-run>" };
  }
  const rows = await rest(table, { method: "POST", body: [payload], prefer: "return=representation" });
  return Array.isArray(rows) ? rows[0] : rows;
}

const YT = (id) => `https://www.youtube.com/watch?v=${id}`;
const SAMPLE_PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const SAMPLE_DOC = "https://file-examples.com/storage/fe7d1e6e5f0e0e2a4b0f9d2/2017/02/file-sample_100kB.doc";

const SUBJECTS = [
  {
    name: "برمجة 1",
    name_en: "Programming 1",
    professor: "د. أحمد سالم",
    description: "مقدمة في البرمجة باستخدام بايثون: المتغيرات، الشروط، الحلقات، والدوال.",
    schedule: "الاثنين 08:00 ص - 10:00 ص",
    location: "مدرج 1 - الدور الأول",
    level: 1,
    semester: 1,
    is_academic: true,
    show_on_home: true,
    status: "approved",
    lectures: [
      { key: "lec-programming-1", label: "مقدمة في البرمجة", order: 1, video: YT("rfscVS0vtbw"), videoTitle: "مقدمة في البرمجة (شرح)", file: SAMPLE_PDF, fileTitle: "ملزمة المحاضرة الأولى" },
      { key: "lec-programming-2", label: "الدوال والكائنات", order: 2, video: YT("_uQrJ0TkZlc"), videoTitle: "الدوال والكائنات (شرح)", file: SAMPLE_DOC, fileTitle: "تمارين المحاضرة الثانية" },
    ],
    quiz: {
      title: "اختبار تجريبي — أساسيات البرمجة",
      description: "اختبار قصير للتأكد من عمل مسار الاختبارات.",
      duration_seconds: 900,
      questions: [
        { question: "ما ناتج العملية 2 + 2 في بايثون؟", options: ["3", "4", "5", "6"], correct: 1, explanation: "4 — عملية جمع بسيطة." },
        { question: "أي مما يلي نوع بيانات في بايثون؟", options: ["integer", "string", "boolean", "كل ما سبق"], correct: 3, explanation: "بايثون تدعم الأنواع الثلاثة." },
        { question: "ما وظيفة الدالة print()؟", options: ["الطباعة", "الحذف", "الحساب", "التخزين"], correct: 0, explanation: "print تطبع قيمة على المخرجات." },
      ],
    },
  },
  {
    name: "رياضيات 1",
    name_en: "Mathematics 1",
    professor: "د. منى عبد الله",
    description: "التفاضل والتكامل والجبر الخطي مع تطبيقات هندسية.",
    schedule: "الأربعاء 10:00 ص - 12:00 م",
    location: "مدرج 3 - الدور الثاني",
    level: 1,
    semester: 1,
    is_academic: true,
    show_on_home: true,
    status: "approved",
    lectures: [
      { key: "lec-math-1", label: "التفاضل", order: 1, video: YT("WUvTyaaNkzM"), videoTitle: "أساس التفاضل (شرح)", file: SAMPLE_PDF, fileTitle: "ملزمة التفاضل" },
      { key: "lec-math-2", label: "الجبر الخطي", order: 2, video: YT("fNk_zzaMoSs"), videoTitle: "المتجهات (شرح)", file: null, fileTitle: null },
    ],
  },
  {
    name: "مقدمة في الحاسب",
    name_en: "Introduction to Computers",
    professor: "د. ياسر فتحي",
    description: "مقدمة في علوم الحاسب: العتاد، الأنظمة، وهياكل البيانات الأساسية.",
    schedule: "الخميس 08:00 ص - 09:30 ص",
    location: "قاعة الحاسب 2",
    level: 1,
    semester: 1,
    is_academic: true,
    show_on_home: true,
    status: "approved",
    lectures: [
      { key: "lec-cs-1", label: "مقدمة في علوم الحاسب", order: 1, video: YT("kqtD5dpn9C8"), videoTitle: "مقدمة في البرمجة (شرح)", file: SAMPLE_PDF, fileTitle: "ملزمة المقدمة" },
      { key: "lec-cs-2", label: "هياكل البيانات", order: 2, video: YT("RBSGKlAvoiM"), videoTitle: "هياكل البيانات (شرح)", file: null, fileTitle: null },
    ],
  },
];

const COLUMN_FALLBACK = {
  subjects: ["name", "name_en", "professor", "description", "schedule", "location", "level", "semester", "is_academic", "show_on_home", "status"],
  subject_lectures: ["subject", "lecture_key", "lecture_label", "order_index"],
  videos: ["subject", "subject_id", "title", "url", "language", "lecture_key", "lecture_id"],
  files: ["subject", "subject_id", "title", "file_url", "description", "lecture_key", "lecture_id"],
  quizzes: ["title", "description", "subject_id", "duration_minutes", "max_attempts", "passing_score"],
  quiz_questions: ["quiz_id", "question", "options", "correct_answer", "explanation", "image_url", "order_index"],
};

async function main() {
  console.log(`[seed] target ${SUPABASE_URL} ${DRY_RUN ? "(dry-run — no writes)" : "(live writes)"}`);
  const cols = {};
  for (const t of Object.keys(COLUMN_FALLBACK)) cols[t] = await tableColumns(t, COLUMN_FALLBACK[t]);
  console.log("[seed] resolved columns:", JSON.stringify(cols));

  for (const s of SUBJECTS) {
    const subjectPayload = filterPayload(
      {
        name: s.name, name_en: s.name_en, professor: s.professor, description: s.description,
        schedule: s.schedule, location: s.location, level: s.level, semester: s.semester,
        is_academic: s.is_academic, show_on_home: s.show_on_home, status: s.status,
      },
      cols.subjects, "subjects",
    );
    const subject = await upsert("subjects", subjectPayload, "name");
    const subjectId = subject?.id ?? null;
    console.log(`[seed] subject "${s.name}" -> ${subjectId ?? "(dry-run)"}`);

    for (const l of s.lectures) {
      const lecPayload = filterPayload(
        { subject: s.name, lecture_key: l.key, lecture_label: l.label, order_index: l.order },
        cols.subject_lectures, "subject_lectures",
      );
      const lecture = await upsert("subject_lectures", lecPayload, "subject,lecture_key");
      const lectureId = lecture?.id ?? "<dry-run>";
      if (l.video) {
        await ensure(
          "videos",
          `subject=eq.${encodeURIComponent(s.name)}&lecture_key=eq.${encodeURIComponent(l.key)}`,
          filterPayload(
            { subject: s.name, subject_id: subjectId, title: l.videoTitle, url: l.video, language: "ar", lecture_key: l.key, lecture_id: lectureId },
            cols.videos, "videos",
          ),
        );
      }
      if (l.file) {
        await ensure(
          "files",
          `subject=eq.${encodeURIComponent(s.name)}&title=eq.${encodeURIComponent(l.fileTitle)}`,
          filterPayload(
            { subject: s.name, subject_id: subjectId, title: l.fileTitle, file_url: l.file, description: l.label, lecture_key: l.key, lecture_id: lectureId },
            cols.files, "files",
          ),
        );
      }
    }

    if (s.quiz) {
      const quiz = await ensure(
        "quizzes",
        `title=eq.${encodeURIComponent(s.quiz.title)}`,
        filterPayload(
          {
            title: s.quiz.title,
            description: s.quiz.description,
            subject: s.name,
            duration_seconds: s.quiz.duration_seconds,
            status: "approved",
            lecture_key: s.lectures[0].key,
          },
          cols.quizzes, "quizzes",
        ),
      );
      if (quiz?.id && quiz.id !== "<dry-run>") {
        const existing = await rest("quiz_questions", { query: `select=id&quiz_id=eq.${quiz.id}&limit=1` });
        if (Array.isArray(existing) && existing.length === 0) {
          const rows = s.quiz.questions.map((q, index) =>
            filterPayload(
              { quiz_id: quiz.id, question: q.question, options: q.options, correct_answer: q.correct, explanation: q.explanation, image_url: null, order_index: index },
              cols.quiz_questions, "quiz_questions",
            ),
          );
          if (DRY_RUN) console.log(`[seed][dry-run] INSERT ${rows.length} quiz_questions`);
          else await rest("quiz_questions", { method: "POST", body: rows });
        } else {
          console.log("[seed] quiz_questions already present — skipping");
        }
      } else if (DRY_RUN) {
        console.log("[seed][dry-run] would insert 3 quiz_questions");
      }
    }
  }
  console.log(`[seed] done ${DRY_RUN ? "(dry-run)" : "— content is live"}`);
}

main().catch((e) => {
  console.error("[seed] FAILED:", e.message);
  process.exit(1);
});
