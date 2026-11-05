# Masar X — Performance Audit (2026-11-02)

**Scope:** monorepo-wide (web, Supabase backend, edge functions, desktop, mobile) · **Method:** production build + local Lighthouse runs + 20 parallel domain auditors + coordinator spot-checks · **Status:** analysis & docs only — zero code changed, nothing committed.

---

## ببساطة (خلاصة بالعربي)

عملنا فحص أداء شامل للمشروع كله: بنينا نسخة الإنتاج وشغلنا Lighthouse على 7 صفحات، ووزّعنا 20 وكيل ذكاء اصطناعي على مجالات مختلفة (واجهة الويب، قاعدة البيانات، دوال السيرفر، الديسكتوب، الموبايل). النتيجة: **139 ملاحظة، منها 3 عاجلة (P0)، و42 مهمة (P1)**.

**أهم 5 أشياء لازم تعرفها:**

1. **كل صفحة تقريبًا فارغة في الـ HTML الأولي.** مكوّن `PageTransition` ملفوف بـ `ssr:false`، فالمتصفح يستلم صفحة فاضية ويستنى تحميل الجافاسكريبت وبعدها يجيب البيانات. هذا سبب بطء صفحة الذكاء الاصطناعي (LCP = 9 ثواني) وصفحة الاختبار (5.9 ثانية). إصلاح واحد يعالج المشكلتين (SPLIT-1).
2. **الفوتر "يقفز" في 4 صفحات** (مواد، اختبارات، أخبار، لعب اختبار) لأن المحتوى يوصل متأخر ويزحقه — هذا الـ CLS المقاس 0.89–0.92 (المسموح 0.1). نفس الإصلاح رقم 1 + skeletons يحلّه.
3. **نسخة الديسكتوب محمّلة كيس وحقائب زائدة: 248 MB بدل ~60 MB.** 185 MB منها ملفات sharp لأنظمة تشغيل ثانية (لينكس وماك) مش هنحتاجها أبدًا، وفوقها **مشكلة عاجلة: مكتبة الصور في نسخة الديسكتوب مكسورة أصلًا** (ملفات DLL ناقصة من الحزمة — الصور المحسّنة هتفشل). (PKG-1/2/3, DESKTOP-2)
4. **الاستعلامات بتجيب صفوف أضعف الحاجة:** صفحة الاختبارات تجيب كل جدول الاختبارات بلا حد، وصفحة المحاضرة تجيب 1,700 صف عشان تعرض محاضرة واحدة، وصفحة الكورس تعمل 6 طلبات ورا بعض لما ممكن تكون متوازية. (FETCH-1/2, QUERY-2)
5. **كل طلب مدفوع الاشتراك بيدفع 3-4 نداءات شبكة مكررة قبل أي رسم:** الـ middleware يسأل Supabase "مين المستخدم؟" وبعدها الـ layout يسأله تاني، وبعدها `/api/auth/sync` يجيب البروفايل للمرة الثالثة والنتيجة تترمي. (MID-1/2, AUTH-3)

**اللي سليم فعلًا:** الصفحة الرئيسية وصفحة الدخول ممتازين (96/100)، الصور والخطوط والأنيميشن على الويب سليمة، كود الأدمن ما بيتسربش لغير الأدمن، وخط الأنalytics الجديد (Upstash) مصمم كويس. تقرير كامل بالتفاصيل والأدلة تحت.

---

## Reading order

1. `measurement/build-2026-11-02.md` — build facts (all-dynamic routes, 248 MB standalone breakdown, chunk sizes, cache headers)
2. `measurement/lighthouse-2026-11-02.md` — Lighthouse scores for 7 routes + root-cause attribution (footer CLS, ai-assistant LCP chain)
3. `findings/01…20-*.md` — the 20 domain reports (139 findings, each with `file:line` evidence + fix + effort)
4. `enhancement-plan.md` — the prioritized roadmap distilled from all of the above

## Findings index

| # | Domain | File | Findings (P0/P1/P2) |
| --- | --- | --- | --- |
| 01 | Web bundle & dependency weight | [01-bundle-dependencies.md](./findings/01-bundle-dependencies.md) | 7 (0/3/4) |
| 02 | Client-side fetching & dual cache | [02-client-fetching.md](./findings/02-client-fetching.md) | 7 (0/5/2) |
| 03 | Rendering & re-render coupling | [03-rendering.md](./findings/03-rendering.md) | 8 (0/2/6) |
| 04 | Code splitting & route streaming | [04-splitting-streaming.md](./findings/04-splitting-streaming.md) | 9 (**2**/3/4) |
| 05 | Heavy assets, images, fonts, media | [05-assets-media.md](./findings/05-assets-media.md) | 4 (0/1/3) |
| 06 | AI chat interaction | [06-ai-chat.md](./findings/06-ai-chat.md) | 8 (0/4/4) |
| 07 | Landing & hero | [07-landing.md](./findings/07-landing.md) | 4 (0/0/4) |
| 08 | Middleware/proxy & i18n request path | [08-middleware-i18n.md](./findings/08-middleware-i18n.md) | 7 (0/3/4) |
| 09 | Admin dashboard & analytics UI | [09-admin.md](./findings/09-admin.md) | 7 (0/3/4) |
| 10 | PWA/SW & HTTP caching | [10-pwa-caching.md](./findings/10-pwa-caching.md) | 5 (0/1/4) |
| 11 | DB indexes & access paths | [11-db-indexes.md](./findings/11-db-indexes.md) | 9 (0/2/7) |
| 12 | Query waterfalls & N+1 | [12-query-waterfalls.md](./findings/12-query-waterfalls.md) | 9 (0/2/7) |
| 13 | Supabase edge functions | [13-edge-functions.md](./findings/13-edge-functions.md) | 11 (0/2/9) |
| 14 | Analytics pipeline & legacy | [14-analytics.md](./findings/14-analytics.md) | 6 (0/0/6) |
| 15 | RLS & definer-function cost | [15-rls.md](./findings/15-rls.md) | 9 (0/3/6) |
| 16 | Auth/session/background chatter | [16-auth-session.md](./findings/16-auth-session.md) | 8 (0/3/5) |
| 17 | Desktop cold start & runtime | [17-desktop-coldstart.md](./findings/17-desktop-coldstart.md) | 5 (0/2/3) |
| 18 | Desktop packaging & install | [18-desktop-packaging.md](./findings/18-desktop-packaging.md) | 6 (**1**/2/3) |
| 19 | Mobile startup & screens | [19-mobile-startup.md](./findings/19-mobile-startup.md) | 5 (0/1/4) |
| 20 | Mobile data layer & bundle | [20-mobile-data.md](./findings/20-mobile-data.md) | 5 (0/0/5) |
| | **Total** | | **139 (3/42/94)** |

## Methodology

- **Measurements (main session, 2026-11-02):** `pnpm --filter web build` (Turbopack — same mode as CI/Vercel); `next start` on :3111; Lighthouse 13.6.0 (Chrome headless, mobile emulation, default throttling) on 7 routes; `curl -I` header capture; `du`/`find` over `.next/standalone`, `.next/static/chunks`, `public/`.
- **Auditors:** 18 `general-purpose` subagents (domains 01–18) dispatched in parallel batches; domains 19–20 (mobile) were analyzed by the coordinator after the subagent quota was exhausted — same evidence standard, marked in the files.
- **Agent rules:** read-only; no builds/servers/git; every finding needs `path:line` evidence from files actually read; max ~12 findings; verify older claims in `docs/audits/performance-audit.md` before repeating ("(recurring)").
- **Validation (I10):** ≥25% of load-bearing claims spot-checked by the coordinator against the tree (SPLIT-1 Layout wiring, proxy `getUser()`, desktop 500 ms wait, PKG-1 DLL absence measured directly, AUTH-3 forced sync, ASSET-1 gitignore entry — all passed). Cross-agent contradictions were resolved and noted (e.g., DB claims re-verified against the spec-031 baseline; client-vs-RSC misattributions corrected in 12).
- **Known issues during the run:** (a) the provider concurrency limit forced smaller dispatch batches — 18 of 20 agents completed via retries; (b) the raw build log and 7 Lighthouse reports were **lost to a workspace cleanup between 2026-11-02 and 2026-11-03** (a parallel session works on this machine; `.tmp/perf-audit/` and the first write of `measurement/*.md` were wiped). All numbers were preserved in-session and re-verified against the still-present build output on 2026-11-03; raw-report loss is recorded in the measurement docs.
- **Scope boundaries honored:** static-only for desktop/mobile (no device runs — measurement plans included in 17/19); no DB connections; no deploys.

## Relationship to existing docs

- Builds on `docs/audits/performance-audit.md` (older claims re-verified: unmemoized AuthContext confirmed RENDER-1; react-hot-toast claim closed — removed; Vite leftovers narrowed to 2 devDeps).
- Builds on `docs/scratch/Masarx performance optimization plan.md` (its KaTeX/Puter measurements re-confirmed as already code-split — the eager-import problem moved to admin/lottie/framer-motion).
- Feeds `docs/perf/baselines.md` (all budgets still [TBD] — this audit supplies first data points; wiring the >20% regression gates is part of the plan).
- Does **not** modify any of them; next-doc updates are owner's call.

## Rules note (MVP Lock / I11)

This audit changes nothing. Any implementation track selected from `enhancement-plan.md` needs an approved spec per **I11 (spec-first)**; under the **MVP Lock**, only deployment-readiness items (the P0s: packaged-app image breakage, installer bloat) and blocking-bug work are eligible before launch — owner decision required for the rest.
