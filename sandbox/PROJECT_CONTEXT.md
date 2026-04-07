# دليل المطور - Masar X Developer Context Guide

## نظرة عامة على المشروع
Masar X هو منصة تعليمية شاملة مبنية بـ Next.js (React/TypeScript) باستخدام App Router، متخصصة في تقديم خدمات تعليمية للطلاب الجامعيين في الشرق الأوسط.

### الميزات الأساسية
- **نظام TRW (The Road Within)**: نظام دورات مدفوع مع إدارة اشتراكات وخطط وصول (Free/Full/Money).
- **منصة التلخيصات**: نظام crowdsourced لمشاركة وتنظيم التلخيصات الأكاديمية.
- **الدورات التفاعلية**: إدارة دورات كاملة مع التسجيل وتتبع التقدم ونظام مراجعات متطور.
- **مساعد AI**: مدعوم بـ Puter.js و **GPT-5 nano** مع دعم Markdown و LaTeX و RAG.
- **الاختبارات**: نظام اختبارات تفاعلي يدعم المسودات، التوقيت، والتحقق من الصلاحيات.
- **نظام الأدوار المتعدد**: أدوار Student/Instructor/Admin مع إدارة صلاحيات شاملة (RLS).
- **نظام التهيئة الأكاديمية (Academic Onboarding)**: إجبار الطلاب على اختيار تخصصهم لمرة واحدة مع caching متقدم ومنع Flicker.
- **التدويل (Localization)**: دعم كامل للغتين العربية والإنجليزية (ar/en) باستخدام `next-intl` مع نظام ملفات JSON في `src/messages/`.

---

## هيكل المشروع (Architecture)

### Frontend Stack
- **Next.js 16.2.x** مع App Router ودعم i18n
- **React 19** مع TypeScript صارم
- **Tailwind CSS** مع PostCSS للتصميم
- **Context API** لإدارة الحالة العامة
- **Supabase SSR (@supabase/ssr)** لدعم تكامل Supabase مع App Router (cookies/session)
- **TanStack Query (React Query)** لإدارة جلب البيانات والتخزين المؤقت (Caching)
- **Drizzle ORM** للتعامل مع قاعدة البيانات بأنواع صارمة
- **Framer Motion** للتحريكات وتجربة المستخدم السلسة
- **Next-Intl** لإدارة الترجمة والتدويل (Localization) عبر `src/app/[locale]`

### Backend Stack
- **Supabase** (PostgreSQL + Auth + Storage + Edge Functions)
- **20+ migration files** لقاعدة البيانات
- **Row Level Security (RLS)** للأمان المتقدم
- **Real-time subscriptions** للتحديثات الفورية

### DevOps & Deployment
- **Next.js sitemap.ts**: توليد خريطة الموقع تلقائيًا بدلاً من الطرق التقليدية
- **Vercel** للنشر مع تحسينات الأداء
- **ESLint + TypeScript strict mode** للجودة
- **PWA support** للتطبيق المحمول عبر `sw.js`
- **Security headers / CSP**: إعدادات متقدمة في `vercel.json` تشمل `masar-x.vercel.app`
- **Next/Image remotePatterns** مقيّدة في `next.config.mjs` (بدون wildcard)

---

## هيكل الملفات الرئيسي

### `/src` - الكود الأساسي

#### `/app/[locale]` - صفحات Next.js App Router (i18n)
- **layout.tsx**: التخطيط الجذر للتطبيق مع دعم اللغة
- **page.tsx**: الصفحة الرئيسية لكل لغة
- **loading.tsx** & **error.tsx**: معالجة الحالات الخاصة
- **ملاحظة**: ملف `middleware.ts` موجود في `src/lib/supabase/middleware.ts` لمعالجة المصادقة/التحكم بالطلبات.

#### `/messages` - ملفات الترجمة (JSON)
- `ar/`: ملفات الترجمة العربية
- `en/`: ملفات الترجمة الإنجليزية

#### `/contexts` - إدارة الحالة العامة
- `AuthContext.tsx`: نظام المصادقة المتقدم
  - دعم Google OAuth + Email/Password
  - نظام caching للأدوار الإدارية (50 دقيقة)
  - تحديث البيانات في الخلفية
  - إدارة الصور الشخصية عبر Supabase Edge Function (`upload-avatar`) مع تكامل Cloudinary
- `ThemeContext.tsx`: إدارة الوضع الليلي/الفاتح

#### `/hooks` - الوظائف المخصصة
- `useAnalytics.ts`: تتبع استخدام المستخدمين
- `useAppeals.ts`: نظام الاستئنافات للإدارة
- `useAiChat.ts`: منطق محادثة مساعد الذكاء الاصطناعي (حدود الرسائل + وضع Puter)
- `useNews.ts`: إدارة الأخبار والإعلانات
- `useNotifications.ts`: الإشعارات الفورية
- `useOnlineUsers.ts`: تتبع المستخدمين المتصلين
- `usePlatformSettings.ts`: إعدادات المنصة (مثل `active_semester`) مع fallback عبر localStorage
- `useQuizAttempt.ts`: تتبع محاولات الاختبارات
- `useQuizzes.ts`: إدارة الاختبارات
- `useReviews.ts`: نظام المراجعات والتقييمات
- `useSubjects.ts`: إدارة المواد الدراسية
- `useSummaries.ts`: إدارة التلخيصات
- `useTRWHooks.ts`: إدارة اشتراكات ومحتوى نظام TRW
- `useToast.ts`: نظام الإشعارات المحلية
- `useUserAcademic.ts`: إدارة بيانات الطالب الأكاديمية مع نظام caching ومنع الوميض (Flicker)
- `useAcademicOptions.ts`: جلب الخيارات الأكاديمية المتاحة (جامعة/كلية/قسم)

#### `/app` - صفحات التطبيق (App Router)
**الصفحات الأساسية:**
- `/page.tsx`: الصفحة الرئيسية مع التنقل الذكي
- `/news/page.tsx`: الأخبار والإعلانات
- `/subjects/page.tsx`: تصفح المواد الدراسية
- `/subjects/[subject]/page.tsx`: صفحة المادة (محاضرات/محتوى المادة)

**نظام المصادقة:**
- `/login/page.tsx`: تسجيل الدخول
- `/signup/page.tsx`: إنشاء حساب جديد
- `/reset-password/page.tsx`: إعادة تعيين كلمة المرور
- `/profile/page.tsx`: إدارة الملف الشخصي

**المحتوى التعليمي:**
- `/courses/page.tsx`: تصفح الدورات
- `/courses/[id]/page.tsx`: تفاصيل الدورة مع المحتوى
- `/add-summary/page.tsx`: إضافة تلخيص جديد
- `/edit-summary/page.tsx`: تعديل التلخيص (عبر `?id=` أو Param)
- `/summaries/[summaryId]/page.tsx`: صفحة تفاصيل الملخص
- `/quizzes/page.tsx`: لوحة الاختبارات
- `/quiz-play/page.tsx`: تشغيل الاختبارات (يدعم `?quizId=`)
- `/quiz-play/[quizId]/page.tsx`: تشغيل الاختبارات عبر Param
- `/quiz-attempts/page.tsx`: سجل/محاولات الاختبارات
- `/add-file/page.tsx`: رفع/إضافة ملفات مرتبطة بالمادة
- `/add-video/page.tsx`: إضافة فيديو

**نظام TRW:**
- `/trw/page.tsx`: الصفحة الرئيسية لـ TRW
- `/trw/[categorySlug]/page.tsx`: تصفح المسارات داخل التصنيف
- `/trw/[categorySlug]/[courseSlug]/page.tsx`: محتوى الكورس المتقدم
- `/trw/my-access/page.tsx`: إدارة اشتراكات المستخدم في TRW
- `/trw/redeem/page.tsx`: تفعيل رموز الوصول (Access Codes)

**الإدارة:**
- `/admin-dashboard/page.tsx`: لوحة تحكم المشرفين (مواد/ملخصات/أخبار/طعون/امتحانات/تحليلات + إدارة الصفحة + كورسات/تسجيلات حسب الدور)
- `/instructor-dashboard/page.tsx`: لوحة تحكم المدرب (طلبات التسجيل + إحصائيات الكورسات)

**AI Assistant:**
- `/ai-assistant/page.tsx`: المحادثة مع AI
  - وضعين: محادثات المجموعة (RAG) + مساعد برمجي
  - إعدادات Puter عبر مودال مخصص
  - توليد اختبارات محليًا + إمكانية إرسال الامتحان للمراجعة والنشر

#### `/components` - المكونات القابلة لإعادة الاستخدام
**المكونات الأساسية:**
- `Layout.tsx`: التخطيط العام مع الهيدر والفوتر
- `Header.tsx`: شريط التنقل العلوي
- `Footer.tsx`: التذييل

**المكونات التفاعلية:**
- `NotificationManager.tsx`: إدارة الإشعارات
- `OnboardingModal.tsx`: نموذج التهيئة الأولية
- `QuizPlayer.tsx`: مشغل الاختبارات

**مكونات الإدارة:**
- `AdminProfileImage.tsx`: إدارة صور الملف الشخصي
- `NewsTab.tsx`, `AppealsTab.tsx`, `QuizzesTab.tsx`: تبويبات الإدارة
- `CoursesTab.tsx`, `EnrollmentsTab.tsx`: إدارة الدورات

**مكونات الدورات:**
- `/course` folder: مكونات إدارة محتوى الدورات
  - `CourseFilesSection.tsx`: إدارة ملفات الدورات
  - `CourseReviewsSection.tsx`: نظام مراجعات الدورات
  - `CourseSummariesSection.tsx`: ملخصات الدورات التفاعلية
  - `CourseVideosSection.tsx`: إدارة فيديوهات الدورات
  - `SubscribeModal.tsx`: نموذج التسجيل في الدورات

**معالجة الأخطاء:**
- `AcademicOnboardingGate.tsx`: حارس يمنع الوصول للمحتوى الأكاديمي قبل إكمال التهيئة
- `TRWAccessGate.tsx`: حارس محتوى TRW حسب نوع الاشتراك
- `ManageLecturesModal.tsx`: إدارة محاضرات المواد (الترتيب، المفاتيح، الربط بـ lecture_id)
- `NotificationDropdown.tsx`: قائمة الإشعارات المحدثة مع دعم الصور
- `ErrorBoundary.tsx`: معالجة أخطاء التطبيق مع واجهة مستخدم عربية وجاهزية للإنتاج
- `QueryProvider.tsx`: مزود TanStack Query للجزء الخاص بـ Client Components

**واجهة المستخدم (UI Components):**
- `/ui` folder: مكونات أساسية (Button, Card, Tabs, Input المطور، Skeleton, etc.)

#### `/lib` - المكتبات والمساعدات
- `supabase.ts`: إعداد Supabase والعمليات الأساسية
- `puter.ts`: تكامل Puter.js AI
- `cloudinary.ts`: إدارة رفع الملفات
- `analytics.ts`: تتبع استخدام المستخدمين
- `performance.ts`: تحسينات الأداء
- `session.ts`: إدارة الجلسات
- `queryCache.ts`: التخزين المؤقت للاستعلامات

#### `/types` - تعريفات TypeScript
- `database.ts`: أنواع قاعدة البيانات المولدة تلقائيًا
- `generated-database.ts`: أنواع إضافية

#### `/utils` - الأدوات المساعدة
- `notificationUtils.ts`: مساعدات الإشعارات

---

## قاعدة البيانات (Database Schema)

### الجداول الأساسية

#### `profiles` - ملفات المستخدمين
- الصور الشخصية والمعلومات الأساسية
- حقل `show_extra_assets` للتحكم في ظهور الموارد الإضافية
- مرتبط بـ auth.users

#### `admins` - إدارة المشرفين
- جدول منفصل عن metadata لتحكم أفضل.
- المنصة عبارة عن قالب، لذا يجب إضافة المشرفين يدوياً في قاعدة البيانات الخاصة بك.

#### `summaries` - التلخيصات الدراسية
- محتوى غني مع مرفقات PDF
- سير عمل المراجعة (pending → approved/rejected)
- تصنيف حسب المادة والقسم والسنة

#### `courses` - الدورات التعليمية
- إدارة دورات كاملة مع المدرسين
- تتبع التسجيل والمعلومات الوصفية
- دعم نظام التسعير

#### `enrollments` - تسجيل الطلاب
- علاقات الطالب-الدورة مع تتبع التقدم
- حالات التسجيل (pending/active/expired)
- نظام إثبات الدفع

#### `course_summaries`, `course_videos`, `course_files` - محتوى الدورات
- إدارة محتوى الدورات التفصيلية
- مرفقات الملفات والفيديوهات
- التحكم في الوصول بناءً على التسجيل

#### `quizzes` & `quiz_questions` - نظام الاختبارات
- نظام تقييم تفاعلي
- أنواع أسئلة متعددة وتسجيل الدرجات
- تتبع محاولات الاختبار

#### `quiz_attempts` - محاولات الاختبارات
- تتبع محاولات المستخدمين ونتائجهم

#### `subject_lectures` - محاضرات المواد
- نظام الربط المعتمد على `lecture_id` بدلاً من المفاتيح النصية فقط
- مصدر الحقيقة لترتيب المحاضرات (lecture_key/label/order_index)

#### `user_progress` - تقدم المستخدم
- تخزين العناصر المُنجزة للمستخدم (summaries/videos/files/quizzes) وحساب نسبة الإنجاز

#### `chats`, `chat_messages`, `chat_participants` - نظام المحادثة
- نظام محادثة فوري للتواصل بين المستخدمين
- تاريخ محادثات AI
- دعم المحادثات الجماعية والفردية

#### `ai_summaries`, `assistant_messages` - تتبع AI
- تتبع محادثات AI وتلخيصها
- مقاييس الأداء وتحليلات الاستخدام
- إدارة المحادثات المبنية على الجلسات

#### `reviews`, `notifications`, `news` - التفاعل والتواصل
- نظام مراجعات وتقييمات الدورات
- نظام إشعارات فوري
- أخبار وإعلانات مدارة من الإدارة

#### `appeals` - نظام الاستئنافات
- نظام استئنافات إدارة المحتوى
- سير عمل حل النزاعات

### جداول الأمان والتدقيق

#### `audit_logs` - تسجيل شامل للأنشطة
- تتبع إجراءات المستخدمين للامتثال

#### `password_reset_tokens` - إدارة آمنة لإعادة تعيين كلمة المرور

### مكان التخزين (Storage Buckets)

#### `summaries-pdfs` - ملفات PDF العامة
- دليل عام لرفع ملفات PDF
- يقبل ملفات PDF فقط مع حدود الحجم

#### `avatars` - صور الملفات الشخصية
- مع تكامل Cloudinary

#### `payment-proofs` - وثائق إثبات الدفع
- تخزين آمن لمستندات التحقق من الدفع

#### `course-materials` - مواد الدورات المحمية
- دليل محمي لمحتوى الدورات والموارد
- التحكم في الوصول بناءً على التسجيل

#### `course-content` - دلاء إضافية لأنواع المحتوى المختلفة مع صلاحيات دقيقة

---

## الخدمات الخارجية (External Services)

### Supabase Edge Functions
- `upload-avatar`: رفع الصور الشخصية (Cloudinary) وربطها بالمستخدم
- `delete-avatar`: حذف/تنظيف الصور الشخصية
- `upload-file`: رفع ملف (عام/حسب السياسات) مع التحقق
- `delete-file`: حذف ملف بشكل آمن
- `auth-hook-email`: معالجة أحداث المصادقة (hooks)
- `cloudinary-webhook`: استقبال Webhooks من Cloudinary
- `request-password-reset`: إنشاء رموز إعادة تعيين كلمة المرور الآمنة
- `reset-password`: تنفيذ إعادة تعيين كلمة المرور
- `summarize-chat`: تلخيص بيانات محادثة/بيانات مُحمّلة

### Puter.js AI
- تكامل للمساعدة الدراسية الذكية عبر SDK المتصفح.
- دعم المحادثات مع تاريخ المحادثات.
- تحليل المحتوى وإنشاء التلخيصات.

### Cloudinary
- إدارة رفع ومعالجة الصور
- تحسين الصور تلقائيًا
- تخزين آمن مع URLs موقّعة

### Brevo (Sendinblue)
- إرسال إشعارات البريد الإلكتروني المتقدمة
- إدارة حملات التسويق عبر البريد الإلكتروني
- إعادة تعيين كلمة المرور وإشعارات النظام
- تتبع وتحليلات البريد الإلكتروني
- قوالب بريد إلكتروني مخصصة وقابلة للبرمجة
- **ملاحظة تنفيذية**: إرسال إيميلات Supabase Auth (signup/recovery/magiclink/email_change) يتم عبر Edge Function `auth-hook-email` باستخدام Brevo API.

---

## نظام الأمان والصلاحيات

### المصادقة (Authentication)
- Supabase Auth مع دعم البريد الإلكتروني وكلمة المرور
- Google OAuth للتسجيل السريع
- JWT tokens لإدارة الجلسات مع التجديد التلقائي

### التحكم في الوصول (Authorization)
- نظام الأدوار الثلاث: Student/Instructor/Admin
- Row Level Security (RLS) مع 20+ سياسة أمان
- التحقق المزدوج من الأدوار (metadata + database)

### أمان البيانات
- تشفير البيانات في حالة الراحة (PostgreSQL encryption)
- تشفير في حالة النقل (HTTPS/TLS)
- إدارة آمنة لمفاتيح API

### أمان المحتوى
- التحقق من نوع الملفات وأحجامها
- فحص الفيروسات التلقائي
- URLs موقّعة للوصول الآمن للملفات

---

## سير العمل التطويري

### البيئة المحلية
```bash
npm install
npm run dev  # تطوير (http://localhost:3000)
npm run build  # بناء للإنتاج
npm run start  # تشغيل الإنتاج محلياً
```

### قاعدة البيانات
```bash
npx supabase start  # البيئة المحلية
npx supabase db reset  # إعادة تعيين قاعدة البيانات
npx supabase db remote commit  # للإنتاج
```

### المتطلبات
- Node.js 18+
- Supabase account
- Puter.js Integration
- Brevo account (Sendinblue) لإرسال رسائل البريد الخاصة بالمصادقة
- مفاتيح Cloudinary

---

## نقاط الاهتمام الخاصة

### الأداء
- Lazy loading للصفحات مع Next.js App Router
- Code splitting تلقائي مع Next.js
- Query caching لتقليل الاستعلامات
- Image optimization مع Next.js و Cloudinary

### تجربة المستخدم
- دعم كامل للغة العربية مع RTL
- تصميم متجاوب (mobile-first)
- PWA support للاستخدام دون اتصال
- إشعارات فورية وتحديثات حية

### قابلية الصيانة
- TypeScript strict mode
- ESLint مع قواعد React وإمكانة الوصول
- هيكل مكونات منظم وقابل لإعادة الاستخدام
- توثيق شامل للقاعدة البيانات

---

*آخر تحديث: 04 أبريل 2026*
*المطور: فريق تطوير Masar X*

## Recent edits (April 2026)
- **Next.js 16 Upgrade**: الترقية إلى Next.js 16.2.1 و React 19.2.4 لتحسين الأداء واستخدام الميزات الحديثة.
- **i18n Restructuring**: إعادة هيكلة نظام التدويل ليعتمد على المسارات المبنية على اللغة (`src/app/[locale]`) وتوحيد ملفات الترجمة في `src/messages/`.
- **AI Model Upgrade**: تحديث المساعد الذكي لاستخدام **GPT-5 nano** مع تحسين عرض الرسائل (Markdown/LaTeX) ودعم النسخ والعرض الخام.
- **Drizzle ORM Integration**: إضافة Drizzle ORM للتعامل مع قاعدة البيانات بشكل أكثر أماناً وكفاءة.
- **Middleware Relocation**: نقل `middleware.ts` إلى `src/lib/supabase/middleware.ts` لتحسين تنظيم الكود.
- **Bug Investigation**: تدقيق شامل لنظام المحاضرات وتحديد 13 خطأ مع خطط الإصلاح.

## Recent edits (March 2026)
- **Bug Investigation**: Comprehensive audit of lecture system identifying 13 bugs (3 critical, 6 medium, 4 minor) with detailed reports (BUG_REPORT_LECTURES.md, FIXES_PLAN.md).
- **Localization Completion**: Finalized not-found page localization with JSON-based translations, removed hardcoded strings.
- **Quiz System**: Enhanced QuizzesTab with search, sorting, pagination, and next-intl translations.
- **Localization Overhaul**: Completed full localization for `not-found`, `academic-onboarding`, and main pages using JSON-based translations.
- **TRW Subsystem**: Launched "The Road Within" architecture with membership gating and access code system.
- **Academic Flow**: Implemented `AcademicOnboardingGate` and migrated lecture linking to use `lecture_id` for better data integrity.
- **Build & SEO**: Switched to native `sitemap.ts`, fixed Vercel build errors related to null `created_at` and pre-rendering.
- **AI Improvements**: Added auto-trigger for Puter login when AI limits are reached and improved UI responsiveness.
- **Localization Sync**: إتمام الترجمة لجميع عناصر لوحة التحكم (Admin Dashboard) ونظام الطعون (Appeals).
- **Hydration Strategy**: تطبيق فحص `isMounted` في جميع نماذج الإدخال (Forms) لضمان استقرار الواجهة.
- **Form Refactoring**: إعادة هيكلة `AddFileForm` و `AddVideoForm` لتحسين الأداء والتحقق من البيانات.
- **UI Optimization**: تحسين استجابة القوائم في `Header` و `MobileNav` وتحسين أداء صفحة الكورسات.
## Recent edits (21 Feb 2026)
- Frontend pages and components updated across `src/app/`
- New/backup Supabase migration SQL files added
- Security updates to password reset flow and storage policies

## Recent edits (16 Feb 2026)
- Refactor subject detail page to lecture-first view with lecture sidebar and per-lecture filtered tabs in `src/app/subjects/[subject]/page.tsx`.

## Recent edits (19 Feb 2026)
- Align summaries flow with App Router routes: add/edit pages in `src/app/add-summary` and `src/app/edit-summary`, and details in `src/app/summaries/[summaryId]`.
- Admin dashboard now lives in `src/app/admin-dashboard` (tabs include subjects + manage lectures, summaries moderation, quizzes moderation, news, appeals, analytics, and doctor-only features).
- Platform active semester is managed via `usePlatformSettings` with DB + localStorage fallback.

## Recent edits (21 Feb 2026)
- Update project context to reflect current dependencies (`next@14.2.35`, `@supabase/supabase-js@2.97.x`, `@supabase/ssr@0.8.x`, `react@18.3.x`).
- Deployment hardening notes synced with `vercel.json` (CSP + security headers) and `next.config.mjs` (restricted `next/image` remotePatterns + redirects `/admin` -> `/admin-dashboard`).
- Documented current auth email delivery path via Supabase Edge Function `supabase/functions/auth-hook-email` using **Brevo**.
