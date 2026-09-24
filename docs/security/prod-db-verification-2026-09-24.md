# 🔬 التحقق من قاعدة بيانات الإنتاج — Supabase (MCP، قراءة فقط)

> **التاريخ:** 2026-09-24 · **الفرع:** `fix/security-p0-cves` · **المشروع:** `jcufigozkhxazjbwhjjm`
> **الطريقة:** تفويض لأداة خارجية (OpenCode CLI، موديل `dahl/zai-org/GLM-5.3-Flash`) على سيرفر **Supabase MCP بوضع `--read-only`** — 16 استعلام قراءة فقط. **راجع المُنسّق المخرجات الخام بنفسه** من `events.jsonl` ولم يعتمد على التقرير الذاتي للأداة.
> **حدود الفحص:** لا كتابة في القاعدة · لا فحص لإعدادات Auth/SMTP/Redirect URLs · أعداد مجمّعة فقط (لا بيانات شخصية).

---

## 1) النتائج المؤكدة (Fact Sheet)

| # | البُند | النتيجة في الإنتاج | الدليل |
|---|---|---|---|
| V1 | `password_reset_tokens` أعمدة | `id, user_id, email, **token (NOT NULL)**, expires_at, used_at, created_at, updated_at, token_hash` | `information_schema.columns` |
| V2 | قيود الجدول | `PK(id)` · **`UNIQUE (token)`** · `FK user_id → auth.users ON DELETE CASCADE` | `pg_constraint` |
| V3 | فهارس الجدول | على `email, expires_at, token, token_hash, user_id` — **لا UNIQUE على `token_hash`** | `pg_indexes` |
| V4 | **حجم بيانات التوكنات** | **`total_rows = 0`** · `rows_token_not_null = 0` · `outstanding_unexpired = 0` · `token_hash_set = 0` | `count(*) FILTER (...)` |
| V5 | RLS | مُفعّل على `password_reset_tokens` و`rate_limits` | `pg_class.relrowsecurity` |
| V6 | سياسات `password_reset_tokens` | (أ) `Service role can manage reset tokens` — ALL/`service_role` (ب) **`Users can view their own reset tokens` — SELECT/`authenticated`/`auth.uid() = user_id`** | `pg_policies` |
| V7 | سياسة `rate_limits` | `Service role can manage rate limits` — ALL/`service_role` فقط | `pg_policies` |
| V8 | **شكل `rate_limits`** | `id, identifier, endpoint, request_count, window_start, created_at, updated_at` — **الشكل القديم** — **بلا `key`/`hits`/`last_hit`** | `information_schema.columns` |
| V9 | قيود `rate_limits` | `PK(id)` · **`UNIQUE (identifier, endpoint)`** (`ux_rate_limits_identifier_endpoint`) | `pg_constraint` + `pg_indexes` |
| V10 | صفوف `rate_limits` | **`0` صف** | `count(*)` |
| V11 | **`check_rate_limit(...)`** | **غير موجودة في `public`** — نتيجة `[]` لاستعلام مفلتر بالاسم بدون LIMIT | `pg_proc WHERE proname IN ('check_rate_limit','cleanup_rate_limits')` |
| V12 | **`cleanup_rate_limits(...)`** | **غير موجودة** (نفس الاستعلام) | `pg_proc` |
| V13 | `cleanup_expired_reset_tokens()` | **موجودة في الإنتاج فقط** — `SECURITY DEFINER` · `proconfig = null` (**بلا `search_path`** — نفس صنف F8) · الجسم: `DELETE FROM password_reset_tokens WHERE expires_at < now() OR used_at IS NOT NULL` | `pg_proc` + `pg_get_functiondef` |
| V14 | تاريخ الميغريشنز | **111 صف** — آخرها: `20260922231725 semester_management` · `20260920000811 jwt_role_sync` · `20260919003753 p1_hardening` · `20260918230912 …` | `supabase_migrations.schema_migrations` |
---

## 2) 🔴 ثغرات جديدة (لم تكن في تقرير التدقيق)

### F13 🔴 **`check_rate_limit` غير موجودة في الإنتاج ⇒ كل حدود الـ Edge Functions ميتة (fail-open)**
- **الأثر:** ثلاث دوال تنادي `supabase.rpc('check_rate_limit', …)`: `reset-password` (30/دقيقة)، `request-password-reset` (3/24س لكل إيميل + 10/ساعة لكل IP الجديد)، `cloudinary-webhook`. فشل الـ RPC → `catch` → **استمرار بلا أي تقييد**:
  - **brute-force على `reset-password` بلا سقف** (تجريب توكنات/كلمات مرور لا نهائي) — أخطر بند.
  - سبام إيميلات إعادة تعيين بلا حدود، ومحاولات IP بلا سقف.
  - الـ webhook بلا سقف.
- **دليل مضاعف:** `rate_limits` **صفر صف** (V10) — لو الدالة عملت مرة واحدة لكان فيه صفوف. الفشل ليس نظرياً.
- **دقة:** الفحص مؤكِّد في مخطط `public` (المخطط المكشوف عبر PostgREST)؛ لو كانت في مخطط آخر لكان `rpc()` فشل برضه ⇒ النتيجة العملية واحدة.
- **إصلاح مقترح (يحتاج موافقتك):** إنشاء الدالة بنصّ `migrations.old/20251231200000_add_rate_limiting.sql` **مع `SET search_path = ''`** وتأهيل `public.rate_limits` — يسدّ F13 وF8 معاً. ثم اختبار: `select check_rate_limit('test-ip','test',1,1)` ⇒ `true` ثم `false`.

### F14 🟠 دالة إنتاجية `cleanup_expired_reset_tokens()` بـ `SECURITY DEFINER` بلا `search_path`
- غير موجودة في المستودع إطلاقاً (V13) — لا كود ولا migration محلي يغطيها (جزء من انحراف F10).
- **إصلاح:** تُضاف لنفس migration الإصلاح مع `SET search_path = ''` + تأهيل الجدول.

### F15 🟠 مسار rate limiting في تطبيق الويب **معطّل هيكلياً** في الإنتاج
- `apps/web/src/lib/rate-limit.ts` (أسطر 8-13) يعلن استخدام جدول `rate_limits` بأعمدة **`key` / `hits` / `last_hit`** (نسخة `migrations/006`). الإنتاج فيه الأعمدة القديمة **`identifier`/`endpoint`/`request_count`/`window_start`** (V8) لأن `CREATE TABLE IF NOT EXISTS` في 006 **لم تُنفّذ** (الجدول موجود من 20251231200000 الأقدم).
- ⇒ كل POST إلى `/rest/v1/rate_limits?on_conflict=key` يفشل هيكلياً ⇒ الكود يسقط **دائماً** للذاكرة المحلية (per-instance على Vercel) ⇒ حد الـ AI chat غير فعّال عبر الـ instances.
- **قرارك:** (أ) تعديل الكود لشكل الإنتاج (أقل خطراً)، أو (ب) توحيد الجدول على شكل 006.

### F16 🟡 نتائج تخصّ إصلاح F5/F9 الجاري
- **`token` ما زال `NOT NULL`** (V1) ⇒ **`DROP NOT NULL` في 014 إجباري قبل نشر الدالة المعدّلة**، وإلا كل طلب إعادة تعيين سيفشل (الإدراج لم يعد يبعت `token`).
- **الجدول فارغ** (V4) ⇒ خطوات المسح/الإبطال في 014 **no-op** — لن تُفقد أي لينكات معلّقة (لا توجد) ⇒ يقلّل مخاطر النشر.
---

## 3) تصحيح لافتراضات سابقة

| الافتراض في التدقيق | الواقع المؤكد |
|---|---|
| «الـ counter في جدول `rate_limits` ⇒ يعمل عبر الـ isolates» | الجدول **صحيح الشكل** (V8/V9) لكن **الدالة غائبة** (V11) والجدول صفر صفوف (V10) ⇒ لا يعمل إطلاقاً. «DB-backed ✅» صحيح كتصميم فقط. |
| «014: تمسح plaintext + تُبطل التوكنات» | الجدول فارغ ⇒ لا شيء ليُمسح؛ المطلوب فعلياً **إسقاط NOT NULL** قبل النشر (V1). |
| «انحراف الإنتاج = schema» | أوسع: **أسماء الميغريشنز نفسها مختلفة** — 111 إصدار timestamped بلا أي مكافئ `NNN` (V14/V15)، وهو سبب فشل `supabase db push` (dry-run). |
| «`check_rate_limit` معرّفة في `migrations.old` فتُطبَّق على الإنتاج» | الملف لم يُطبَّق إطلاقاً (V11/V12) — والمجلد مؤرشف وغير مُدار بـ push. |

---

## 4) ما لم يمكن التحقق منه (UNCERTAINTIES)

- **لا دليل** على وجود `pg_cron` أو مُجدول ينادي `cleanup_expired_reset_tokens` — وجودها بلا مُجدول يعني اعتمادها على نداء يدوي.
- **إعدادات Auth** (SMTP، Redirect URLs، حدود GoTrue المدمجة) خارج نطاق MCP-read-only.
- **سجلات الـ Edge Functions** لم تُقرأ — كان ممكن تأكيد F13 تجريبياً من ظهور أخطاء `check_rate_limit` في `function_logs` (خطوة تالية مقترحة).
- **ترتيب الاستعلامات:** استعلام واحد (قائمة الدوال بـ `ILIKE '%rate%'`) رجع 20 صفاً بالظبط — يُحتمل LIMIT، لذا اعتمدتُ على الاستعلامات المفلترة بالاسم (V11/V12) كدليل نهائي.

---

## 5) خطة العمل المتصلة (تحتاج موافقتك قبل أي كتابة)

1. **P0 جديد:** إنشاء `check_rate_limit` في الإنتاج (نصّ `migrations.old` + `SET search_path = ''` + تأهيل `public.rate_limits`) — يكفي وحده لإحياء كل حدود الدوال.
2. **نفس النافذة:** تسجيل الدالة محلياً كـ `015_rate_limit_function_baseline.sql` ليتطابق الريبو مع الإنتاج.
3. **قبل نشر الدالة المعدّلة:** تطبيق `014` (إسقاط NOT NULL) عبر SQL Editor — `db push` محظور (انحراف التاريخ).
4. **F15:** قرار بين تعديل `lib/rate-limit.ts` لشكل الإنتاج أو توحيد الجدول.
5. **F14 + F16-ب:** `SET search_path` للدالة الإنتاجية + إسقاط سياسة `Users can view their own reset tokens`.
6. التحقق التجريبي من F13 عبر `supabase functions logs` (ظهور أخطاء `check_rate_limit`).

> **الدليل الخام الكامل محفوظ في** `%TEMP%\opencode-run-supabase-verify\events.jsonl` (16 استعلام + المخرجات الخام) للمراجعة المستقلة.


