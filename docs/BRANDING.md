# Masar X — Brand Identity (Single Source of Truth)

> **القاعدة:** أي وصف للمنصة في الكود أو الوثائق أو الـ AI يجب أن يطابق هذا الملف حرفياً. ممنوع اختراع صياغات بديلة.
> Last updated: 2026-09-26

## 1. الاسم الرسمي

- AR: **مسار إكس**
- EN: **Masar X**

## 2. التعريف الرسمي الموحد

- AR: **"مسار إكس — منصتك الجامعية المتكاملة: مواد، شروحات، ملخصات، بنوك أسئلة، ومساعد ذكي"**
- EN: **"Masar X — Integrated University Learning Platform: study materials, lectures, summaries, quizzes & AI tutor"**

## 3. الوصف الموسع (للصفحات والميتاداتا)

- AR: "مسار إكس منصتك الجامعية المتكاملة: مقررات ومواد دراسية منظمة، شروحات ومحاضرات، ملخصات، بنوك أسئلة واختبارات، كورسات، ومساعد ذكاء اصطناعي — كل ما تحتاجه للمذاكرة في مكان واحد."
- EN: "Masar X is your integrated university learning platform: organized courses and study materials, lectures and explanations, summaries, question banks and quizzes, courses, and an AI study assistant — everything you need to study in one place."

## 4. ترتيب العرض الإلزامي

عند ذكر الميزات، الترتيب دائماً:

1. المقررات والمواد الدراسية (subjects/materials)
2. الشروحات والمحاضرات (lectures/explanations)
3. بنوك الأسئلة والاختبارات (quizzes/question banks)
4. الكورسات (courses)
5. الملخصات — كجزء من المنظومة وليست الهوية (summaries as part of the system)
6. مساعد ذكاء اصطناعي (AI tutor)

## 5. العبارات الممنوعة (Anti-Regression)

ممنوع استخدام أي من الصياغات التالية في titles أو descriptions أو footers أو FAQ أو llms.txt أو manifest:

- "منصة ملخصات" / "منصة ملخصات دراسية" / "منصة ملخصات الدراسة"
- "منصة لمشاركة الملخصات الدراسية"
- "Study Summaries Platform" / "Study summaries platform"
- أي تعريف يبدأ بالملخصات وكأنها كل المنصة (مثال: "providing study summaries, quizzes, courses" كبداية)

## 6. أين يُطبق التعريف

- `packages/shared/src/messages/{ar,en}/metadata.json`
- `packages/shared/src/messages/{ar,en}/footer.json`
- `packages/shared/src/messages/{ar,en}/faq.json`
- `apps/web/public/manifest.json`
- `apps/web/public/llms.txt`
- الهيرو والفوتر والـ FAQ في الواجهة

## 7. الهوية البصرية (Visual Identity) — مقفلة 2026-09-22

### 7.1 العلامة (The Mark)

علامة "العقدة" ثلاثية الألوان — مسارات متشابكة تكوّن عقدة/مسارًا مغلقًا واحدًا (ترجمة بصرية لاسم «مسار»).

**الألوان الرسمية (مستخرجة من الأصل، لا تعدَّل):**

| اللون | HEX | RGB | الاستخدام |
|---|---|---|---|
| أزرق | `#2C9CEF` | 44,156,239 | مسار العقدة الأزرق |
| أخضر | `#86D042` | 134,208,66 | مسار العقدة الأخضر |
| أخضر مصفر | `#B5C732` | 181,199,50 | منطقة التداخل أخضر→برتقالي |
| عنبري | `#D7AA28` | 215,170,40 | منطقة التداخل أخضر→برتقالي |
| برتقالي | `#F09621` | 240,150,33 | مسار العقدة البرتقالي |

### 7.2 الأصول المرجعية (Masters) — `promo_assets/brand-new/`

| الملف | الوصف |
|---|---|
| `masarx-mark.svg` | العلامة فقط (مربعة، ~9.5KB) — أساس كل الأيقونات |
| `masarx-wordmark.svg` | حروف «MASARX» فقط (فيكتور أصلي من التصدير) |
| `masarx-lockup.svg` | علامة + wordmark (النسخة الإنجليزية الرسمية) |
| `masarx-mark-mono.svg` | نسخة أحادية اللون (`currentColor`) للسياقات الأحادية |
| `logo.png` / `logo.svg` | الأصول الخام الأصلية (أرشيف — لا تُستخدم في الإنتاج) |

إعادة توليد كل أصول الويب: `node apps/web/scripts/generate-icons.mjs` (بعد `node apps/web/scripts/brand/build-masters.mjs` عند تغيير الأصل).
إعادة توليد أيقونة الديسكتوب: `pnpm --filter desktop icons:generate` (من `apps/desktop/scripts/generate-icon.mjs` — سلّم ICO 16–256 + الماستر، تايِل أبيض بزوايا مستديرة).

### 7.3 قواعد الاستخدام الإلزامية

1. **flat فقط في الأحجام الصغيرة** — ممنوع أي لمعان/3D/ظلال داخل العلامة عند الاستخدام كأيقونة.
2. **لا نص داخل العلامة** — الـ wordmark دائمًا منفصل عن العلامة.
3. **قاعدة الواجهة العربية:** تُستخدم **العلامة المستقلة فقط** (بدون الـ wordmark اللاتيني «MASARX») في كل سياقات الواجهة العربية، إلى أن يُصمَّم lockup عربي مطبعي في مرحلة قادمة. لهذا فإن `logo_AR.webp` = العلامة المستقلة، و`logo_EN.webp` = الـ lockup الكامل.
4. **النسخة الأحادية** (`masarx-mark-mono.svg` / `currentColor`) للتبويبات والرموز الأحادية والإشعارات.
5. **مساحة التنفس:** على الأقل 12% من عرض العلامة فارغة حولها؛ لا تُوضع العلامة على خلفيات مزدحمة بلا تباين كافٍ.
6. **ممنوع:** إعادة رسم/إعادة توليد العلامة بالـ AI، تمديدها بشكل غير متساوٍ، تغيير الألوان خارج الجدول أعلاه، أو إضافة تأثيرات.
7. أصول الإنتاج: `favicon.svg` + `favicon.ico` (16/32/48) + `apple-touch-icon.png` (180) + `icons/icon-{192,512}.png` + `icons/maskable-{192,512}.png` + `og-image.png` (1200×630) + أيقونة الديسكتوب `apps/desktop/build/icon.ico` (16–256) — تُدار كلها من الـ masters فقط.

## 8. السلوجان الرسمي (Slogan) — مقفل 2026-09-22

- AR: **«كل جامعتك في مسار واحد»**
- EN: **"Your university, one path."**

### 8.1 قواعد الاستخدام

- السلوجان **مكمل** للتعريف الرسمي الموحد (§2) ولا يحل محله أبدًا؛ التعريف يظل حرفيًا حيث ورد.
- في metadata للـ og/twitter: يُسبَق السلوجان للوصف الرسمي بالصيغة `«السلوجان — الوصف الرسمي»`.
- مواضع حالية: `metadata.json` {ar,en} مفتاح `slogan`، `llms.txt`، وصف og/twitter في `layout.tsx`.
- الترتيب الإلزامي للميزات (§4) والتعريف الرسمي (§2) يسريان على أي جملة تسويقية جديدة تُكتب حول السلوجان.
