# Features — Masar X
> Last updated: 2026-06-03
> Status: `[X]` Complete · `[-]` In Progress · `[!]` Blocked · `[ ]` Planned

## Authentication & Authorization
- `[X]` Email/password registration and login (`src/app/[locale]/login/page.tsx`)
- `[X]` Google OAuth social login
- `[X]` Password reset flow — SHA-256 token hashing, Brevo email delivery
- `[X]` Session management with automatic refresh via Supabase middleware (`src/lib/supabase/middleware.ts`)
- `[X]` Brute-force protection — client-side progressive lockout (sessionStorage, 30s increments up to 5min)
- `[X]` Admin role system — admin, doctor, student_admin with tiered permissions (`src/lib/auth/roles.ts`)
- `[X]` JWT role sync trigger — `admins` table syncs to `auth.users.app_metadata` (`008_jwt_role_sync.sql`)
- `[X]` Auth guard on admin dashboard and onboarding gate for new users
- `[X]` Profile sync from Supabase Auth to custom profiles table (`/api/auth/sync`)
- `[X]` Open redirect protection on auth callback — checks for `://`, `//` patterns
- `[-]` Rate limiting — in-memory only, resets on Vercel cold starts (`src/lib/rate-limit.ts:28`)

## Academic Onboarding
- `[X]` Mandatory specialization selection (academic level + semester) on first login (`src/app/[locale]/onboarding/academic/page.tsx`)
- `[X]` AcademicOnboardingGate — blocks content until onboarding is complete (`src/components/AcademicOnboardingGate.tsx`)
- `[X]` Admin role bypass for onboarding
- `[!]` Hardcoded Arabic strings in onboarding page — not using i18n translation keys

## Study Summaries
- `[X]` Crowdsourced summary submission with title, content, subject, department, level, semester
- `[X]` PDF upload via Cloudinary with progress tracking (`src/lib/cloudinary.ts`)
- `[X]` Image upload and Google Drive link support
- `[X]` YouTube video embedding in summaries
- `[X]` AI-powered OCR extraction from PDF images (calls `process-pdf` Edge Function)
- `[X]` Summary editing with full field modification (`src/app/[locale]/edit-summary/`)
- `[X]` Summary detail view with PDF viewer, contributor info, ratings (`src/app/[locale]/summaries/[summaryId]/page.tsx`)
- `[X]` Admin moderation workflow — pending → approved/rejected (`src/components/admin/SummariesTab.tsx`)
- `[X]` Appeal system for rejected content
- `[!]` OCR processing — `process-pdf` Edge Function does not exist in `supabase/functions/` (broken)

## Courses
- `[X]` Course catalog with search, filtering (all/free/paid), and animated cards (`src/app/[locale]/courses/page.tsx`)
- `[X]` Course detail page with hero section, content tabs (videos/summaries/files/reviews)
- `[X]` Enrollment/subscribe modal with payment proof submission (`src/components/course/SubscribeModal.tsx`)
- `[X]` Review and star rating system per course (`src/components/reviews/`)
- `[X]` Course content management — videos, summaries, files with ordering
- `[X]` Instructor dashboard with course statistics, enrollment management, per-course student tracking (`src/app/[locale]/instructor-dashboard/page.tsx`)
- `[X]` Admin course creation and oversight — doctor role only (`src/components/admin/CoursesTab.tsx`)
- `[X]` Enrollment approval/rejection workflow with payment proof viewing (`src/components/admin/EnrollmentsTab.tsx`)

## Quizzes & Assessments
- `[X]` Quiz dashboard with filters (subject, department, level, semester), create/edit/delete modals (`src/app/[locale]/quizzes/page.tsx`)
- `[X]` Quiz creation with multiple question types and scoring (`src/components/quizzes/QuizFormModal.tsx`)
- `[X]` Quiz import from JSON files (`src/components/quizzes/QuizImportModal.tsx`)
- `[X]` Quiz play interface with timer, answer tracking, auto-save (`src/components/QuizPlayer.tsx`)
- `[X]` KaTeX math rendering in quiz questions (`src/components/quiz/PreloadKatex.tsx`)
- `[X]` Quiz attempts history with expandable question details, score, time tracking (`src/app/[locale]/quiz-attempts/page.tsx`)
- `[X]` Quiz generation from AI chat summaries
- `[X]` Quiz page sub-hooks — useQuizzesData, useQuizzesFilters, useQuizzesModals, useQuizFormState, useQuizImport (`src/app/[locale]/quizzes/_hooks/`)

## AI Assistant
- `[X]` Multi-mode AI chat — group_rag (WhatsApp RAG), cs_assistant (CS tutoring), student_agent (platform Q&A) (`src/lib/ai-assistant.ts` — 1682 lines)
- `[X]` Model selector — Claude Sonnet 4.6, Claude Opus 4.6, Claude Haiku 4.5, GPT variants
- `[X]` Puter.js SDK integration with circuit breaker pattern, auto-retry, cooldown (`src/lib/puter.ts` — 144+ lines)
- `[X]` Auto-fallback from gpt-5.4-nano to gpt-4o-mini on failure
- `[X]` Markdown and KaTeX rendering in AI responses (`src/components/ai/LazyMarkdown.tsx`)
- `[X]` RTL-aligned chat bubbles
- `[X]` Chat history with persistent sessions and AI summaries
- `[X]` Local quiz generation preview from AI responses (`src/components/ai/LocalQuizPreviewModal.tsx`)
- `[X]` Student Agent — platform data retriever and context builder (`src/lib/student-agent/`)
- `[-]` Server-side AI chat — `/api/ai/chat` returns static fallback text only, no real LLM integration
- `[!]` Legacy `gemini-chat` Edge Function reference — dead link from pre-Puter.js migration (`src/lib/ai-assistant.ts`)

## TRW (The Road Within)
- `[X]` TRW landing page with category listing and cover images (`src/app/[locale]/trw/page.tsx`)
- `[X]` TRW category pages with course listings (`src/app/[locale]/trw/[categorySlug]/page.tsx`)
- `[X]` TRW individual course detail pages (`src/app/[locale]/trw/[categorySlug]/[courseSlug]/page.tsx`)
- `[X]` Membership gating with access code redemption (`src/app/[locale]/trw/redeem/page.tsx`)
- `[X]` My Access page showing membership status (`src/app/[locale]/trw/my-access/page.tsx`)
- `[X]` Secret access gate — triggered by logo taps (`src/components/header/SecretAccessGate.tsx`)
- `[X]` TRW access gate component with "Redeem Access Code" fallback UI (`src/components/trw/TRWAccessGate.tsx`)
- `[X]` TRW hooks — useTRWMembership, useTRWCourses, useTRWCourseDetails, useTRWCategories, useTRWProgress, useRedeemAccessCode (`src/hooks/`)

## Notifications
- `[X]` Browser push notification support with permission prompting (`src/components/notifications/NotificationPrompt.tsx`)
- `[X]` Database-backed notification storage
- `[X]` Notification dropdown, list, and settings UI (`src/components/notifications/`)
- `[X]` User notification preferences toggle (`src/components/notifications/NotificationSettings.tsx`)
- `[X]` Service Worker v3 for push notification handling (`public/sw.js`)
- `[!]` Notification time formatting hardcoded in Arabic ("الآن", "منذ X دقيقة") in `src/lib/notificationUtils.ts` — not i18n

## News & Announcements
- `[X]` News feed with category filters (announcement/update/important) (`src/app/[locale]/news/page.tsx`)
- `[X]` Search and image lightbox support
- `[X]` File attachments and AI summary display
- `[X]` Add news modal for logged-in users (`src/components/AddNewsModal.tsx`)
- `[X]` Appeal button for news items
- `[X]` Admin news management — create/edit/delete/toggle visibility (`src/components/admin/NewsTab.tsx`)

## Content Appeals
- `[X]` Appeal submission modal for rejected content (`src/components/AppealFormModal.tsx`)
- `[X]` Appeals list with accept/reject/delete admin actions (`src/components/admin/AppealsTab.tsx`)
- `[X]` Appeals filtering and status tracking (`src/components/appeals/AppealsFilters.tsx`)
- `[!]` Hardcoded Arabic pagination in AppealsTab — "عرض {startIndex} من {filteredAppeals.length} طعن" (`src/components/admin/AppealsTab.tsx:140-142`)

## Reviews & Ratings
- `[X]` Star rating submission for courses (`src/components/reviews/StarRating.tsx`)
- `[X]` Review form with detailed feedback (`src/components/reviews/ReviewForm.tsx`)
- `[X]` Review display with stats and individual items (`src/components/reviews/ReviewItem.tsx`)

## Subjects & Lectures
- `[X]` Subject listing grid with navigation (`src/components/SubjectsGrid.tsx`)
- `[X]` Subject detail pages with content tabs (`src/app/[locale]/subjects/[subject]/page.tsx`)
- `[X]` Lecture detail pages with content rendering (`src/app/[locale]/subjects/[subject]/lectures/[lectureId]/page.tsx`)
- `[X]` Admin subject creation and management (`src/components/admin/SubjectsTab.tsx`)
- `[X]` Lecture management per subject — add/edit/delete (`src/components/ManageLecturesModal.tsx`)
- `[X]` Page visibility management — toggle subject visibility on home per semester (`src/components/admin/PageManagementTab.tsx`)
- `[!]` Lecture inference defaults hardcoded in Arabic ("محاضرة", "غير مصنف") in `src/lib/lecture-inference.ts`

## Admin Dashboard
- `[X]` Tabbed dashboard — Summaries, News, Appeals, Quizzes, Courses, Enrollments, Analytics, Page Management (`src/app/[locale]/admin-dashboard/page.tsx`)
- `[X]` 9 tabs total with role-based access — courses/enrollments/page management restricted to doctor role
- `[X]` Global filters (department, level, subject) across all admin tabs (`src/components/admin/AdminDashboardHeader.tsx`)
- `[X]` Summary moderation with approve/reject/edit/delete
- `[X]` Analytics dashboard — user count, message count, views, clicks, top content types, activity feed (`src/app/[locale]/admin-dashboard/AdminAnalyticsPage.tsx`)
- `[X]` Semester switching for content organization (`src/components/SemesterSwitcher.tsx`)
- `[X]` Subject visibility management per semester

## User Profile
- `[X]` Profile page with display name editing (`src/app/[locale]/profile/page.tsx`)
- `[X]` Avatar upload and management (`src/components/AdminProfileImage.tsx`)
- `[X]` Academic path editing (level/semester/department)
- `[X]` Role display (user/admin/doctor/student_admin)
- `[X]` Activity logs (join date, last activity)
- `[X]` Extra assets toggle (TRW) with 2-hour cooldown

## Internationalization (i18n)
- `[X]` Full Arabic (RTL) and English (LTR) support via next-intl
- `[X]` 40 translation namespaces per locale — perfectly in sync (0 mismatches)
- `[X]` Locale-based routing with `src/app/[locale]` (`src/i18n/routing.ts`)
- `[X]` Dynamic translation imports with three-tier fallback — import → disk read → English (`src/i18n/request.ts` — 192 lines)
- `[X]` In-memory namespace cache to avoid re-imports
- `[!]` FAQ page uses hardcoded Arabic text — not using translation keys (`src/app/[locale]/faq/page.tsx`)
- `[!]` AppealsTab hardcoded Arabic pagination (`src/components/admin/AppealsTab.tsx:140-142`)
- `[!]` notificationUtils hardcoded Arabic time formatting (`src/lib/notificationUtils.ts`)
- `[!]` lecture-inference hardcoded Arabic defaults (`src/lib/lecture-inference.ts`)
- `[!]` subjects.config.ts subject names are all Arabic — no English translations (`src/constants/subjects.config.ts`)

## Layout & Navigation
- `[X]` Responsive header with desktop and mobile navigation (`src/components/Header.tsx`, `src/components/header/DesktopNav.tsx`, `src/components/header/MobileNav.tsx`)
- `[X]` User dropdown menu (`src/components/header/UserMenu.tsx`)
- `[X]` Footer with brand, links, support, and developer sections (`src/components/Footer.tsx`)
- `[X]` Language toggle AR/EN (`src/components/LanguageToggle.tsx`)
- `[X]` Locale-aware dynamic logo (`src/components/DynamicLogo.tsx`)
- `[X]` Dark mode flash prevention via ThemeScript (`src/components/ThemeScript.tsx`)
- `[X]` Page transitions with Framer Motion (`src/components/PageTransition.tsx`)

## UI Component Library
- `[X]` Button, Card, Badge, Input, Textarea, Tabs, Skeleton (`src/components/ui/`)
- `[X]` File dropzone for drag-and-drop uploads (`src/components/FileDropzone.tsx`)
- `[X]` Confirmation toast dialogs (`src/lib/confirmToast.ts`)
- `[X]` Framer Motion animations throughout
- `[X]` Lottie animations via `@lottiefiles/dotlottie-react`
- `[!]` Duplicate SummaryCard component — exists at both `src/components/SummaryCard.tsx` and `src/components/summaries/SummaryCard.tsx`

## Math & LaTeX Rendering
- `[X]` KaTeX integration for mathematical expressions (`katex` v0.16.27)
- `[X]` React-Markdown with LaTeX support in AI responses (`react-katex` v3.0.1)
- `[X]` PreloadKaTeX component for quiz rendering (`src/components/quiz/PreloadKatex.tsx`)
- `[X]` HeavyLatexRenderer for complex expressions

## File Management
- `[X]` Cloudinary integration for file uploads via Edge Functions (`supabase/functions/upload-file/`)
- `[X]` Upload progress tracking with retry logic (`src/lib/cloudinary.ts`)
- `[X]` Supported types — PDF, images, Word, PowerPoint, plain text, ZIP
- `[X]` 50MB file size limit
- `[!]` Upload file — auth enforcement and MIME allowlist noted as pending security tasks in README

## Security
- `[X]` Content-Security-Policy with per-request nonce (`src/middleware.ts`)
- `[X]` Security headers — X-Frame-Options: DENY, nosniff, Referrer-Policy, Permissions-Policy (`vercel.json`)
- `[X]` Row Level Security (RLS) policies across all database tables
- `[X]` Input validation via Zod schemas (`src/lib/validations.ts`, `src/lib/validation/profile.ts`)
- `[X]` JWT verification via `getUser()` instead of `getSession()` in API routes
- `[X]` Audit logging for user actions
- `[X]` Password reset token hashing (SHA-256)
- `[X]` Storage upload restrictions — authenticated users only for summaries-pdfs
- `[X]` PII moved from localStorage to sessionStorage (`src/lib/storage-cleanup.ts`)
- `[X]` Brute-force attempt tracking in sessionStorage
- `[-]` Rate limiting — in-memory only, not distributed across serverless instances
- `[!]` `sentry-example-api` route intentionally throws errors in production — no actual Sentry integration

## Analytics & Monitoring
- `[X]` Event tracking — page views, content clicks, AI interactions, logins (`src/lib/analytics.ts`)
- `[X]` Admin analytics queries — user counts, message counts, content stats (`src/lib/analyticsHelpers.ts`)
- `[X]` Database health check endpoint (`/api/health/db`)
- `[X]` RPC-based admin analytics summary (`get_admin_analytics_summary`)
- `[-]` Logger — console-only, no real monitoring backend wired up (`src/lib/logger.ts:31`)
- `[-]` Dual analytics services — `analytics.ts` and `analyticsHelpers.ts` should be consolidated
- `[ ]` Sentry integration — example API exists but no `@sentry/nextjs` dependency, logger import commented out

## PWA & Offline
- `[X]` Web App Manifest with shortcuts for summaries and news (`public/manifest.json`)
- `[X]` Service Worker v3 for push notifications (`public/sw.js`)
- `[X]` PWA install prompt component (`src/components/PWAInstallPrompt.tsx`)
- `[X]` Custom notification sounds (`public/notification-sound.mp3`, `public/notification-sound.wav`)
- `[!]` PWA manifest references `/logo.png` which does not exist — only `logo_AR.png` and `logo_EN.png` in `public/`
- `[!]` Service Worker completeness unverified

## Developer Tooling
- `[X]` TypeScript with strict type checking (`tsconfig.json` — target ES2020)
- `[X]` ESLint with React and accessibility rules (max-warnings=300)
- `[X]` Bundle analyzer via `@next/bundle-analyzer`
- `[X]` Drizzle ORM for type-safe database queries (`src/lib/admin-db/`)
- `[X]` Quiz test scripts for development (`test_quiz/` directory)
- `[X]` Auth route checking script (`scripts/auth-route-check.mjs`)
- `[X]` MCP (Model Context Protocol) server endpoint (`src/app/api/mcp/route.ts`)
- `[!]` Unused devDependencies — `vite`, `@vitejs/plugin-react`, `vite-plugin-compression`, `vite-plugin-pwa` (no vite config exists)
- `[!]` `react-hot-toast` in dependencies but unused — `sonner` is the active toast library

## API Routes
- `[X]` POST `/api/auth/sync` — profile sync after login (Node.js runtime)
- `[X]` GET `/api/health/db` — database connectivity health check with latency
- `[X]` POST `/api/ai/chat` — server-side AI chat (static fallback only)
- `[X]` GET `/api/admin/drizzle-profiles` — admin-only Drizzle query test (hardcoded limit 5)
- `[X]` GET/POST `/api/mcp` — MCP server with `get_project_info` tool
- `[X]` GET `/api/sentry-example-api` — Sentry test error endpoint

## Edge Functions
- `[X]` upload-file — Cloudinary file upload with CORS and auth (`supabase/functions/upload-file/`)
- `[X]` Shared CORS utilities (`supabase/functions/_shared/cors.ts`)
- `[X]` Request password reset — Brevo email, SHA-256 token hashing, rate limiting (`supabase/functions/request-password-reset/`)
- `[X]` Reset password — token verification and password update (`supabase/functions/reset-password/`)
- `[X]` Auth hook email — authentication event handling (`supabase/functions/auth-hook-email/`)
- `[X]` Cloudinary webhook — async processing handler (`supabase/functions/cloudinary-webhook/`)
- `[X]` Upload avatar / Delete avatar — Cloudinary avatar management (`supabase/functions/upload-avatar/`, `delete-avatar/`)
- `[X]` Delete file — ownership enforcement (`supabase/functions/delete-file/`)
- `[X]` Summarize chat — AI-powered chat summarization (`supabase/functions/summarize-chat/`)
- `[!]` process-pdf — referenced in OCR flow but file missing from `supabase/functions/`
- `[!]` gemini-chat — legacy dead reference from pre-Puter.js migration

## Database
- `[X]` 20+ tables — profiles, admins, summaries, courses, enrollments, quizzes, quiz_answers, quiz_attempts, reviews, news, appeals, notifications, messages, ai_summaries, chats, trw_categories, trw_courses, trw_memberships, trw_access_codes, trw_progress, audit_logs, system_logs, rate_limits, analytics_events, platform_settings, password_reset_tokens
- `[X]` Views — review_details, summaries_with_ratings
- `[X]` 8 numbered migrations (001-008) + ~30 archived in `migrations.old/`
- `[X]` Seed data for development (`supabase/seed.sql`)
- `[X]` Drizzle schema — profiles, subjects, subjectLectures, videos, files (`src/lib/admin-db/schema.ts`)
- `[!]` `schema_dump.sql` is empty (0 lines) — no database documentation
- `[!]` `src/types/generated-database.ts` is empty (0 lines)
- `[!]` `src/types/supabase.ts` is empty (0 lines)
- `[!]` `analytics`, `system_logs`, `platform_settings` tables used in code but not defined in `src/types/database.ts`

## Server Actions
- `[X]` `syncUserProfile()` — fetches Supabase user, upserts into admins table (`src/actions/auth.ts`)
- `[X]` `updateProfile()` — Zod-validated profile updates (`src/actions/profile.ts`)
- `[X]` `addFile()`, `addVideo()`, `addSubject()`, `deleteSubject()` — content management with Cloudinary (`src/actions/content.ts`)

## Contexts & Providers
- `[X]` AuthContext — session, user, role management (`src/contexts/AuthContext.tsx` — 233 lines)
- `[X]` PlatformSettingsContext — platform-wide settings with Supabase realtime (`src/contexts/PlatformSettingsContext.tsx`)
- `[X]` ThemeContext — dark/light mode (`src/contexts/ThemeContext.tsx`)
- `[X]` AppProviders — wraps Auth, Query, PlatformSettings, Theme, Notifications, Layout, Toaster (`src/components/AppProviders.tsx`)

## Hooks
- `[X]` 37 custom hooks — 25 top-level + 6 TRW + 6 quiz sub-hooks
- `[X]` Key hooks: useQuizzes, useQuizPlayerRuntime, useSubjects, useSummaries, useCourses, useNews, useReviews, useEnrollments, useNotifications, useAiChat, useAnalytics, useAppeals, usePlatformSettings
- `[X]` TRW hooks: useTRWMembership, useTRWCourses, useTRWCourseDetails, useTRWCategories, useTRWProgress, useRedeemAccessCode

## Type Definitions
- `[X]` Database types (`src/types/database.ts` — 735 lines)
- `[X]` Component prop types, API response types (`src/types/`)
- `[!]` `src/types/generated-database.ts` — empty file, unused
- `[!]` `src/types/supabase.ts` — empty file, unused

## Constants & Config
- `[X]` Subject definitions (`src/constants/subjects.config.ts`) — all Arabic, no English
- `[X]` Academic constants (`src/constants/academic.ts`)
- `[X]` Tailwind config with brand colors and RTL plugin (`tailwind.config.js`)
- `[X]` Next.js config with webpack aliases for next-intl (`next.config.mjs`)
