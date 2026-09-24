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

> **الدليل الخام الكامل محفوظ في** `%TEMP%\opencode-run-supabase-verify\events.jsonl` (16 استعلام) و`%TEMP%\opencode-run-prod-round2\events.jsonl` (13 استعلام) للمراجعة المستقلة.

---

## 6) ملحق الجولة الثانية (2026-09-24) — تدقيق أعمق على الدوال والصلاحيات

> الموديل: `opencode/muse-spark-1.3-contributor-free` (بموافقة صريحة من المالك) · `status: completed` · **صفر ملفات متغيرة** (`touchedFiles` = لا شيء).

### 6.1 حقائق مؤكدة (W1–W7)

| # | البُند | النتيجة | الدليل |
|---|---|---|---|
| W1 | البحث في **كل المخططات** عن `check_rate_limit` / `cleanup_rate_limits` | **صفر نتيجة** — الدالتان غير موجودتين في أي مخطط | `pg_proc ⋈ pg_namespace WHERE proname IN (…)` بلا فلترة مخطط |
| W2 | صف الميغريشن `20251231200000` | **مسجّل** باسم `add_rate_limiting`، `stmt_count = 7`، ونصّه يحتوي فعلاً على إنشاء الجدول والدالة | `array_to_string(statements, E'\n')` |
| W3 | أي صف تاريخي يحوي `DROP FUNCTION … check_rate_limit` | **`[]` — لا شيء** ⇒ **إزالة الدالة غير مسجّلة في تاريخ الميغريشنز** | regex على `statements` |
| W4 | صفوف تذكر `check_rate_limit` | 4 صفوف: `add_rate_limiting` · `ensure_rate_limits_before_fix` · `fix_rate_limits_unique` · `ensure_rate_limits_table` (كلها 2025-12-31 → 2026-01-21) | نفس الاستعلام |
| W5 | `pg_cron` | **غير مثبّت** (`pg_extension` فيه `pg_net 0.19.5` فقط) ⇒ **لا يوجد أي جدولة** | `pg_extension` |
| W6 | صلاحيات `cleanup_expired_reset_tokens()` | `proacl = {=X/postgres, postgres=X/postgres, **anon=X**, **authenticated=X**, service_role=X}` ⇒ **`anon` و`authenticated` يملكان EXECUTE** | `pg_proc` + `has_function_privilege` |
| W7 | صلاحيات `admin_migrate_student_semesters(int,bool)` | نفس الشيء: `anon=X, authenticated=X` — **لكن** الجسم محمي داخلياً: `IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'` + `SET search_path = public` (013:77-84) ⇒ **غير مُستغَل** | `pg_proc` + كود 013 |
| W8 | جرد دوال `public` بـ `SECURITY DEFINER` وقابلة للنداء بـ `anon` | **10+ دوال** (قائمة مقتطعة عند 900 حرف): `admin_migrate_student_semesters` · `audit_table_changes` · `cleanup_expired_reset_tokens` · `delete_old_ai_chat_messages` · `get_admin_analytics_summary` · `get_content_analytics_internal` · `handle_auth_user_update` · `handle_new_user` · `is_admin` · `is_trw_member` … | `has_function_privilege('anon', oid, 'EXECUTE')` |

### 6.2 استنتاجات (وقائع ← استنتاج)

- **الجدول `rate_limits` أُنشئ فعلاً** (W2/W8) لكن **الدالة لم تُنشأ أو أُزيلت بلا أثر في السجل** (W1/W3/W4). الوصف الأدق: *مسجّلة كمُطبَّقة، والدالة غائبة، والإزالة غير مفسّرة* — جزء من انحراف F10.
- ملف `migrations.old/20260121055000_ensure_rate_limits_table.sql` يذكر صراحة أن الدالتين «يُفترض وجودهما» — أي أن الفريق كان يعرف الغياب ضمنياً في 2026-01-21 ولم يُصلحه. **الغياب قديم (8 أشهر) وليس حادثاً جديداً.**
- **لا جدولة إطلاقاً** (W5) ⇒ لو كان مسار الاستعادة المخصص مُستخدمًا لكانت صفوف `password_reset_tokens` **تتراكم بلا تنظيف**. **صفر صف ⇒ المسار المخصص لم يُستخدم ولا مرة** (اتفاق تام مع نتيجة جولة الـ callers: الويب يستخدم GoTrue الأصلي).
- **`get_admin_analytics_summary`** (`migrations.old/20251227074230…`) فيه تعليق المطوّر حرفياً: «Check if user is admin … The RLS policies will handle access control» و`SECURITY DEFINER` **بلا `search_path` وبلا فحص داخلي** ⇒ **RLS لا يُطبَّق داخل دالة `SECURITY DEFINER`** ⇒ نداء مجهول قد يُعيد ملخّص تحليلات المنصة. **مؤقّتاً غير مؤكد التنفيذ:** يحتاج تأكيد وجود جدولي `analytics` و`assistant_messages` في الإنتاج (لو غائبين فالدالة تفشل عند التشغيل).

### 6.3 تصحيح شدّة F13 (بناءً على مراجعة مالك المشروع)
| البند السابق | التصحيح |
|---|---|
| «brute-force بلا سقف على `reset-password` — أخطر بند» | **مبالغة.** التوكن = `nanoid(32)` بأبجدية 64 حرفاً = **192 بت إنتروبي** ⇒ تخمين التوكن مستحيل عملياً؛ الفشل الأمني ليس في حدود المعدّل بل في التحقق (وهو سليم بالـ hash). |
| الأثر الحقيقي للحدود الميتة | (أ) `request-password-reset` = **مضخّم سبام إيميل** بلا سقف (كل نداء = إيميل Brevo فعلي + بحث admin في auth) على مسار عام بلا JWT؛ (ب) عمل غير محدود على القاعدة؛ (ج) لا تغطية ضد الإساءة الآلية. |
| واقعة تخفّض الشدة | مسار الاستعادة المخصص **غير مستخدم في الويب**: `login/page.tsx:160` → `resetPasswordForEmail` ثم `reset-password/page.tsx:71-80` → `exchangeCodeForSession` + `updateUser` (GoTrue الأصلي). الدالتان تبقى **سطح هجوم عام** (`verify_jwt=false`) فيجب إصلاحهما لا حذفهما بلا تحقق. |

### 6.4 F17 🟠 (جديد): `EXECUTE` ممنوح لـ `anon`/`authenticated` على دوال `SECURITY DEFINER` في `public`
- **الواقع (W6/W8):** الجرد أظهر **10+ دوال** `SECURITY DEFINER` في `public` بقاعدة الصلاحيات الافتراضية (`=X/postgres`) ⇒ `anon` و`authenticated` يملكان EXECUTE ⇒ كل منها **قابلة للنداء من PostgREST بلا مصادقة** (`POST /rest/v1/rpc/<fn>`).
- **خطر مؤكد على `cleanup_expired_reset_tokens`:** أي زائر مجهول ينفّذ حذفاً على `password_reset_tokens` (محدود بالمنتهية/المستخدمة — أثر منخفض، لكنه **حذف بلا مصادقة**).
- **خطر محتمل غير مؤكد:** `get_admin_analytics_summary` · `get_content_analytics_internal` (تسريب تحليلات لو بلا فحص داخلي وجداولهما موجودة) · `delete_old_ai_chat_messages` (حذف) · `audit_table_changes` · `handle_auth_user_update`.
- **مقابل مشرّف:** `admin_migrate_student_semesters` محمي داخلياً (`is_admin()` + `search_path=public`) — النمط الصحيح موجود في الكود الأحدث (013) والمطلوب تعميمه.
- **الإصلاح القياسي:** `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon, authenticated;` + `GRANT EXECUTE … TO service_role` + `SET search_path = ''` بتأهيل كامل. **يجب جرد كل دالة على حدة**: بعضها يُنادى من الواجهة عبر `rpc()` (`is_admin`, `is_trw_member`) — سحب صلاحيته يكسر الواجهة.

### 6.5 أسئلة مفتوحة (تحتاج جولة ثالثة قبل أي REVOKE)
1. أجسام: `get_admin_analytics_summary` · `get_content_analytics_internal` · `delete_old_ai_chat_messages` · `audit_table_changes` · `handle_auth_user_update` — هل فيها فحص `is_admin()`/`auth.uid()` داخلي؟ وهل فيها `SET search_path`؟
2. وجود جدولي `analytics` و`assistant_messages` في الإنتاج (يحدد إن كان تسريب التحليلات قابلاً للتنفيذ).
3. أي دوال `rpc()` يناديها الكود فعلاً — لتحديد القائمة الآمنة للـ REVOKE.




