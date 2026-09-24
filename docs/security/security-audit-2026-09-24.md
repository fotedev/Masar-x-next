# 🛡️ تقرير الفحص الأمني الشامل — منصة مسار X

> **التاريخ:** 2026-09-24 · **الفرع:** `refactor/decouple-trw-subjects` @ `fbeaf83`
> **المنهجية:** فحص ساكن للكود (SAST يدوي) + `pnpm audit` للتبعيات + مراجعة الـ Edge Functions + مراجعة RLS/migrations + مراجعة الـ CI + مطابقة مع الثغرات الموثقة سابقاً (`docs/MVP_REPORT.md`).
> **النطاق:** `apps/web` (Next.js 16.2.1 / React 19.2.4)، `supabase/` (13 migration + 11 edge function)، CI/CD، `packages/shared`.
> **خارج النطاق:** اختبار اختراق حي (DAST/Pentest) على الإنتاج — يُنصح به كخطوة تالية.

---

## 1) الملخص التنفيذي

| التصنيف | العدد | أبرز البنود |
|---|---|---|
| 🔴 حرجة | 2 | تبعيات Next.js الحرجة (RCE) · ثغرة Vitest (بيئة التطوير) |
| 🟠 عالية | 5 | تعداد المستخدمين في استعادة كلمة المرور · تخزين التوكن plaintext · sharp · Electron EOL · 117 تنبيه تبعيات |
| 🟡 متوسطة | 6 | Webhook بدون توقيع HMAC · دوال SECURITY DEFINER بدون search_path · مدة توكن الاستعادة 24 ساعة · انحراف قاعدة الإنتاج عن الـ migrations · حماية admin من جهة العميل · rate-limit fail-open |
| 🟢 منخفضة / مقبولة | 4 | موثقة ومقبولة بقرار مسبق (انظر §6) |

**الحكم العام:** البنية الأمنية الأساسية **قوية وناضجة** (CSP بـ nonce، fail-closed على الحساس، RLS مدقق، gitleaks في CI). الخطر الفعلي الحالي مصدره **(أ) تبعيات قديمة عليها CVEs حرجة، (ب) خللان في مسار استعادة كلمة المرور، (ج) webhook Cloudinary بدون تحقق توقيعي**.

---

## 2) نقاط القوة المؤكدة (لا تلمسها أثناء الإصلاح)

| البند | المكان | الحالة |
|---|---|---|
| لا أسرار في git؛ `.gitignore` محكم | `git ls-files` → `.env.example` فقط | ✅ متحقق |
| CSP بـ nonce لكل طلب + `wasm-unsafe-eval` بدل `unsafe-eval` في الإنتاج | `apps/web/src/proxy.ts` | ✅ |
| Headers أساسية (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | `apps/web/next.config.mjs` | ✅ |
| Service-role key خادم فقط (`server-only` import) | `lib/supabase/admin.ts` | ✅ |
| حماية OAuth callback من open-redirect (يرفض `//`, `://`, `/\`) | `[locale]/auth/callback/route.ts` | ✅ |
| مصادقة API عبر `getUser()` (تحقق JWT حقيقي) + zod + rate-limit | `lib/api-auth.ts`, `api/ai-chat` | ✅ |
| `/api/mcp` و `/api/health/db` fail-closed في الإنتاج بدون secret | الملفان المعنيان | ✅ |
| CORS allow-list في الـ Edge Functions | `supabase/functions/_shared/cors.ts` | ✅ |
| `upload-file`: 401 بدون مستخدم + قائمة MIME مسموحة + حد 50MB | `supabase/functions/upload-file` | ✅ |
| `reset-password`: يتحقق من `expires_at` و `used_at` ويعتمد `token_hash` | `supabase/functions/reset-password` | ✅ |
| ترميز Markdown بدون `rehype-raw` (لا HTML خام ⇒ لا XSS مخزّن من هذا المسار) | `components/ai/MarkdownRendererHeavy.tsx` | ✅ |
| gitleaks في CI على الكود والـ build artifacts | `.github/workflows/ci.yml` + `.gitleaks.toml` | ✅ |
| Dependabot مفعّل | `.github/dependabot.yml` | ✅ |
| RLS: تدقيق إنتاج ناجح 2026-09-17 (19 جدول/41 سياسة في الـ migrations) | `docs/MVP_REPORT.md` G3.1 | ✅ |

---

## 3) الثغرات الحرجة والعالية — تفاصيل وإثبات وإصلاح

### F1 🔴 تبعيات Next.js 16.2.1 عليها CVEs حرجة (RCE)
- **الإثبات:** `pnpm audit` (2026-09-24): **6 critical / 57 high / 58 moderate / 8 low = 117 advisory**، منها على `next`:
  - CRITICAL: *Unauthenticated RCE on Windows-hosted servers*
  - CRITICAL: *Unauthenticated RCE in Image Optimization API (AVIF)*
  - HIGH: DoS في Server Components · تجاوز Middleware/Proxy عبر segment-prefetch · تسميم كاش RSC
  - MODERATE: XSS في مسار nonce الخاص بـ CSP · XSS في beforeInteractive
- **التأثير:** الإنتاج على Vercel (Linux) أقل عرضة لثغرة Windows، لكن ثغرة Image Optimization والـ DoS وتجاوز الـ middleware تمسّ نشرك مباشرة (لديك `output: standalone` + صور + auth gating في الـ proxy).
- **الإصلاح:** ترقية `next` إلى آخر إصدار مُرقّع من خط 16.x فوراً، ثم `pnpm install && pnpm build && pnpm test` + e2e، ثم إعادة `pnpm audit` للتأكد من اختفاء تنبيهات `next`.

### F2 🔴 Vitest 2.1.8 — RCE (بيئة التطوير فقط)
- **الإثبات:** CRITICAL ×2 على `vitest` / `@vitest/mocker` (تنفيذ كود عند زيارة موقع خبيث أثناء عمل Vitest API/UI).
- **التأثير:** جهاز المطوّر فقط — لا يمس الإنتاج، لكنه حرج محلياً.
- **الإصلاح:** ترقية vitest لأحدث إصدار مُرقّع، وعدم فتح مواقع غير موثوقة أثناء `vitest --ui` أو وضع watch.

### F3 🟠 sharp ^0.35.4 — ثغرات libheif (HIGH)
- **الإثبات:** HIGH على `sharp` (GHSA-g89c-p67h-r497 + GHSA-2jg2-4ch7-h545). تبعية مباشرة تُستخدم في معالجة الصور مع Next standalone في الإنتاج.
- **الإصلاح:** ترقية `sharp` إلى أحدث إصدار مُرقّع متوافق.

### F4 🟠 استعادة كلمة المرور — تعداد المستخدمين (User Enumeration)
- **المكان:** `supabase/functions/request-password-reset/index.ts:204-217`
- **الإثبات:** عند عدم وجود المستخدم يُرجع المسار المبكر `{ success: true, debug: "No user found in auth.users" }` — بينما المسار العام (221-235) مصمم صحيحاً («نفس الرد دائماً»). حقل `debug` يكسر التصميم ويكشف للمهاجم أي بريد مسجّل.
- **الإصلاح:** حذف المسار المبكر وإرجاع `successResponse` الموحّد دائماً.

### F5 🟠 استعادة كلمة المرور — التوكن يُخزّن plaintext بجانب الـ hash
- **المكان:** `supabase/functions/request-password-reset/index.ts:266-272`
- **الإثبات:** `tokenData` يحتوي `token: resetToken` (الخام) **و** `token_hash` معاً. تخزين الخام يُبطل الغرض من الـ hashing عند أي تسريب لقاعدة البيانات.
- **الإصلاح:** إزالة `token` من الإدراج والاعتماد على `token_hash` فقط (دالة `reset-password` تتحقق من الـ hash أصلاً). ثم إفراغ العمود للتوكنات القديمة.

### F6 🟠 Electron 32 (مثبّت، EOL) — ~63 تنبيه أمني
- **الإثبات:** غالبية تنبيهات الـ audit على `electron`: Context isolation bypass، Use-after-free، ASAR integrity bypass… الإصدار مثبّت بدقة بموجب Invariant I6 وقد خرج من الدعم.
- **الحالة:** موثّق سلفاً (MVP_REPORT §0) — سطح الهجوم = تطبيق سطح المكتب فقط. مؤجّل post-MVP بقرار مالك، لكنه **يبقى ثغرة قائمة**؛ يجب جدولة ترقية Electron (مع مطابقة ABI لـ better-sqlite3) في أول spec بعد الإطلاق.

---

## 4) الثغرات المتوسطة

### F7 🟡 webhook Cloudinary بدون تحقق توقيعي (HMAC)
- **المكان:** `supabase/functions/cloudinary-webhook/index.ts`
- **الإثبات:** التحقق الوحيد هو header ثابت `x-api-key` بمقارنة `!==` (غير ثابتة الزمن)، ولا يوجد تحقق من توقيع Cloudinary الرسمي على الـ payload. كما يُدرج الـ payload في جدول `summaries` **بدون تعقيم** (`title = payload.public_id`، `pdf_url = payload.url`) — من يملك/يسرق المفتاح يحقن صفوفاً، و`pdf_url` قد يكون رابط تصيّد يُعرض لاحقاً في الواجهة.
- **الإصلاح:** (1) مقارنة ثابتة الزمن، (2) الأفضل: تفعيل توقيع إشعارات Cloudinary والتحقق منه، (3) تحقق Zod من `payload.url` (https + hostname `res.cloudinary.com` فقط) قبل الإدراج، (4) تدوير `CLOUDINARY_WEBHOOK_KEY` دورياً.

### F8 🟡 دوال SECURITY DEFINER بدون تثبيت `search_path`
- **الإثبات:** `SET search_path` موجود فقط في migrations 010/011/013، بينما هذه الدوال SECURITY DEFINER بدونه: `handle_new_user()` (002:52-58)، دالة الـ audit (006:97)، دوال JWT role sync (008 و 012:13-41).
- **الخطر:** هجوم schema-shadowing على الدوال مرتفعة الصلاحية (يحذر منه فاحص Supabase الرسمي).
- **الإصلاح:** migration جديد يضيف `SET search_path = ''` لكل دالة SECURITY DEFINER قديمة.

### F9 🟡 مدة توكن استعادة كلمة المرور 24 ساعة
- **المكان:** `request-password-reset/index.ts:271` (`Date.now() + 86400000`).
- **الخطر:** نافذة طويلة لتوكن يغيّر كلمة المرور (المعيار: ساعة واحدة).
- **الإصلاح:** تقليصها إلى `3600000` + إبطال توكنات المستخدم السابقة عند إصدار جديد.

### F10 🟡 انحراف قاعدة الإنتاج عن الـ migrations (G3.9)
- **الإثبات:** الإنتاج فيه **48 جدول / 170 سياسة** مقابل **19/41** في الـ migrations (موثّق في MVP_REPORT). أي تعديل من لوحة Supabase قد يترك جدولاً مكشوفاً بعيداً عن مراجعة الكود.
- **الإصلاح:** post-MVP — تصدير مخطط الإنتاج الحي كـ baseline migration وتثبيت قاعدة «لا تعديل من اللوحة إلا عبر migration».

### F11 🟡 بوابة admin على صفحات الإضافة من جهة العميل فقط (G3.3)
- **الإثبات:** الـ proxy يحمي `/add-file` و`/add-video` بمجرد تسجيل الدخول (وليس بدور admin)، وفحص الدور داخل النموذج في المتصفح؛ الإنفاذ الحقيقي على RLS (مدقق وسليم).
- **الحالة:** مقبول للـ MVP ومُوثّق — التحسين المقترح: فحص دور في الـ proxy أو layout خادم.

### F12 🟡 Rate limiting بنمط fail-open + fallback ذاكرة على serverless
- **الإثبات:** `lib/rate-limit.ts` موثّق صراحة: «Store errors FAIL OPEN»؛ وبدون Upstash يعمل in-memory لكل instance (غير فعّال توزيعياً على Vercel). نفس النمط في الـ edge functions (`catch { // allow on error }`).
- **الإصلاح:** تفعيل Upstash في الإنتاج (`UPSTASH_REDIS_REST_URL/TOKEN`)؛ وتوثيق fail-open كخطر مقبول (هو كذلك تصميمياً حالياً).

---

## 5) ملخص ثغرات التبعيات (`pnpm audit` — 2026-09-24)

| الحزمة | الخطورة | أبرز الثغرات | البيئة |
|---|---|---|---|
| `next` 16.2.1 | 🔴 CRITICAL ×2 + HIGH ×3+ | RCE (Windows/Image-API) · DoS · Middleware bypass · Cache poisoning | **إنتاج** |
| `vitest` 2.1.8 (+`@vitest/mocker`) | 🔴 CRITICAL ×2 | RCE/قراءة ملفات عبر Vitest API/UI | تطوير فقط |
| `sharp` 0.35.x | 🟠 HIGH | ثغرات libheif | **إنتاج** (معالجة صور) |
| `electron` 32 | 🟠 ~63 تنبيه (عدة HIGH) | Context-isolation bypass · UAF · ASAR bypass | سطح المكتب |
| `@xmldom/xmldom` | 🟠 HIGH ×10+ | XML injection / DoS | انتقالية — حدّد مصدرها |
| `tar`, `extract-zip`, `image-size`, `js-yaml`, `fast-xml-parser`, `qs`, `postcss`, `esbuild`, `vite`, `hono`, `decode-uri-component`, `send` | 🟠/🟡 | Path traversal · ReDoS · DoS | غالباً build/dev |
| **الإجمالي** | **6 critical / 57 high / 58 moderate / 8 low** | 117 advisory | — |

> ملاحظة: Dependabot مفعّل وآخر قياس موثّق (2026-09-16): 193 تنبيه مفتوح (63 electron). الترقيات الكبرى للموبايل مُعلّقة عمداً حتى post-MVP.

---

## 6) ثغرات موثقة سابقاً وحالتها (من `docs/MVP_REPORT.md`)

| ID | البند | الحالة |
|---|---|---|
| G3.1 | حالة RLS الحية غير متحققة | ✅ **أُغلقت** — تدقيق إنتاج ناجح 2026-09-17 |
| G3.3 | Admin gating من جهة العميل | 🟡 مقبول للـ MVP (انظر F11) |
| G3.4 | انتشار إلغاء صلاحية admin | ✅ **أُغلقت** — `012_jwt_role_sync` مطبّق على الإنتاج 2026-09-20 |
| G3.6 | Dependabot غير مُدار | 🟡 جزئي — الإعداد سليم، الفرز متبقٍّ (انظر §5) |
| G3.7 | مثبّت Windows غير موقّع | 🟠 مفتوح — SmartScreen سيحذر (شهادة EV مخططة) |
| G3.8 | قابلية توصيل بريد إعادة التعيين | 🟡 جزئي — لم يُختبر بريد حقيقي في الإنتاج |
| G3.9 | انحراف قاعدة الإنتاج | 🟡 مقبول (انظر F10) |

---

## 7) خطة المعالجة بترتيب الأولوية

**P0 — فوري (هذا الأسبوع):**
1. ترقية `next` لأحدث 16.x مُرقّع + `sharp` — ثم build/test/e2e (F1, F3).
2. حذف حقل `debug` من `request-password-reset` (F4 — سطر واحد).
3. إيقاف تخزين التوكن plaintext (F5 — حذف `token: resetToken` من الإدراج).
4. التأكد من ضبط `HEALTH_CHECK_SECRET` و `VERCEL_MCP_BYPASS_SECRET` في بيئة Vercel للإنتاج.

**P1 — خلال أسبوعين:**
5. webhook Cloudinary: مقارنة ثابتة الزمن + تحقق Zod من الـ payload + دراسة توقيع HMAC (F7).
6. تقليص TTL للتوكن إلى ساعة + إبطال التوكنات السابقة (F9).
7. ترقية `vitest` (F2) وفرز تنبيهات Dependabot الحرجة/العالية.
8. migration لتثبيت `search_path` على دوال SECURITY DEFINER (F8).

**P2 — post-MVP (يتطلب رفع MVP Lock أو موافقة مالك):**
9. ترقية Electron + better-sqlite3 ABI + توقيع المثبّت (F6, G3.7).
10. تفعيل Upstash للـ rate limiting التوزيعي (F12).
11. مصالحة مخطط الإنتاج مع الـ migrations (F10) وفحص دور admin في الـ proxy (F11).
12. اختبار اختراق خارجي (pentest) قبل التوسع.

---

## 8) حدود هذا الفحص وملاحظات سلامة git

- الفحص **ساكن** (قراءة كود + audit تبعيات) — لم يُجرَ اختبار اختراق حي على الإنتاج، ولم تُفحص إعدادات لوحة Supabase (Auth/SMTP/redirect URLs) لأنها خارج المستودع.
- لم يُعدَّل **أي** ملف موجود؛ الأثر الوحيد على git هو هذا الملف الجديد: `docs/security/security-audit-2026-09-24.md` (untracked — قرار commit لك).
- الملفات المؤقتة للفحص نُقلت إلى `.trash/security-audit-tmp/` التزاماً بالقاعدة I9 (لا حذف مباشر).
- الـ stash الحالي (`stash@{0}`, `stash@{1}`) والمجلد `specs/015_test_coverage_critical_paths/` لم تُمسّ.

*أُعد بواسطة فحص آلي مُوجَّه — يُنصح بمراجعة بشرية للبنود الحرجة قبل التنفيذ.*

