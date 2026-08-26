# Masar X Developer Context Guide

## Project Overview
Masar X is a comprehensive learning platform built with Next.js (React/TypeScript) using the App Router, focused on delivering educational services for university students in the Middle East.

### Core Features
- **TRW System (The Road Within)**: A paid course system with subscriptions and access plans (Free/Full/Money).
- **Summaries Platform**: A crowdsourced system for sharing and organizing academic summaries.
- **Interactive Courses**: Full course management with enrollment, progress tracking, and an advanced reviews system.
- **AI Assistant**: Powered by Puter.js and **GPT-5 nano** with Markdown, LaTeX, and RAG support.
- **Quizzes**: Interactive quizzes system supporting drafts, timers, and permission checks.
- **Multi-Role System**: Student/Instructor/Admin roles with comprehensive permissions management (RLS).
- **Academic Onboarding**: Forces students to choose their specialization once, with advanced caching and flicker prevention.
- **Localization (i18n)**: Full Arabic and English support (ar/en) using `next-intl` with JSON message files in `src/messages/`.

---

## Architecture

### Frontend Stack
- **Next.js 16.2.x** with App Router and i18n support
- **React 19** with strict TypeScript
- **Tailwind CSS** with PostCSS
- **Context API** for global state management
- **Supabase SSR (@supabase/ssr)** for Supabase integration with App Router (cookies/session)
- **TanStack Query (React Query)** for data fetching and caching
- **Drizzle ORM** for type-safe database access
- **Framer Motion** for animations and smooth UX
- **Next-Intl** for localization via `src/app/[locale]`

### Backend Stack
- **Supabase** (PostgreSQL + Auth + Storage + Edge Functions)
- **20+ migration files** for the database
- **Row Level Security (RLS)** for advanced security
- **Real-time subscriptions** for live updates

### DevOps & Deployment
- **Next.js `sitemap.ts`**: automatic sitemap generation instead of legacy approaches
- **Vercel** for deployment with performance optimizations
- **ESLint + TypeScript strict mode** for quality
- **PWA support** via `sw.js`
- **Security headers / CSP**: advanced setup in `vercel.json` including `masar-x.vercel.app`
- **Next/Image `remotePatterns`** restricted in `next.config.mjs` (no wildcard)

---

## Main File Structure

### `/src` - Core code

#### `/app/[locale]` - Next.js App Router pages (i18n)
- **layout.tsx**: root app layout with locale support
- **page.tsx**: home page per locale
- **loading.tsx** & **error.tsx**: special state handling
- **Note**: `middleware.ts` lives at `src/lib/supabase/middleware.ts` to handle auth/request control.

#### `/messages` - Translation files (JSON)
- `ar/`: Arabic translations
- `en/`: English translations

#### `/contexts` - Global state management
- `AuthContext.tsx`: advanced authentication system
  - Google OAuth + Email/Password
  - Admin role caching (50 minutes)
  - Background refresh
  - Avatar management via Supabase Edge Function (`upload-avatar`) with Cloudinary integration
- `ThemeContext.tsx`: dark/light mode

#### `/hooks` - Custom hooks
- `useAnalytics.ts`: usage tracking
- `useAppeals.ts`: admin appeals system
- `useAiChat.ts`: AI chat logic (limits + Puter mode)
- `useNews.ts`: news/announcements
- `useNotifications.ts`: realtime notifications
- `useOnlineUsers.ts`: online users tracking
- `usePlatformSettings.ts`: platform settings (e.g. `active_semester`) with localStorage fallback
- `useQuizAttempt.ts`: quiz attempts tracking
- `useQuizzes.ts`: quiz management
- `useReviews.ts`: reviews/ratings
- `useSubjects.ts`: subjects management
- `useSummaries.ts`: summaries management
- `useTRWHooks.ts`: TRW subscriptions and content
- `useToast.ts`: local toasts
- `useUserAcademic.ts`: academic user data with caching + flicker prevention
- `useAcademicOptions.ts`: fetch academic options (university/college/department)

#### `/app` - App routes (App Router)
**Core pages:**
- `/page.tsx`: home page with smart navigation
- `/news/page.tsx`: news & announcements
- `/subjects/page.tsx`: browse subjects
- `/subjects/[subject]/page.tsx`: subject page (lectures/subject content)

**Auth:**
- `/login/page.tsx`: login
- `/signup/page.tsx`: sign up
- `/reset-password/page.tsx`: reset password
- `/profile/page.tsx`: profile management

**Educational content:**
- `/courses/page.tsx`: browse courses
- `/courses/[id]/page.tsx`: course details + content
- `/add-summary/page.tsx`: add a summary
- `/edit-summary/page.tsx`: edit summary (via `?id=` or param)
- `/summaries/[summaryId]/page.tsx`: summary details
- `/quizzes/page.tsx`: quizzes dashboard
- `/quiz-play/page.tsx`: play quiz (supports `?quizId=`)
- `/quiz-play/[quizId]/page.tsx`: play quiz via param
- `/quiz-attempts/page.tsx`: quiz attempts history
- `/add-file/page.tsx`: upload/add files linked to subject
- `/add-video/page.tsx`: add video

**TRW system:**
- `/trw/page.tsx`: TRW home
- `/trw/[categorySlug]/page.tsx`: browse tracks within category
- `/trw/[categorySlug]/[courseSlug]/page.tsx`: advanced course content
- `/trw/my-access/page.tsx`: manage TRW access
- `/trw/redeem/page.tsx`: redeem access codes

**Admin:**
- `/admin-dashboard/page.tsx`: admin dashboard (subjects/summaries/news/appeals/quizzes/analytics + page management + courses/enrollments based on role)
- `/instructor-dashboard/page.tsx`: instructor dashboard (enrollment requests + course stats)

**AI Assistant:**
- `/ai-assistant/page.tsx`: AI chat
  - Two modes: group chats (RAG) + coding assistant
  - Puter settings via a dedicated modal
  - Local quiz generation + ability to submit for review/publishing

#### `/components` - Reusable components
**Core components:**
- `Layout.tsx`: overall layout with header/footer
- `Header.tsx`: top navigation
- `Footer.tsx`: footer

**Interactive:**
- `NotificationManager.tsx`: notifications manager
- `OnboardingModal.tsx`: onboarding modal
- `QuizPlayer.tsx`: quiz player

**Admin components:**
- `AdminProfileImage.tsx`: profile image handling
- `NewsTab.tsx`, `AppealsTab.tsx`, `QuizzesTab.tsx`: admin tabs
- `CoursesTab.tsx`, `EnrollmentsTab.tsx`: courses management

**Course components:**
- `/course` folder: course content management components
  - `CourseFilesSection.tsx`: course files
  - `CourseReviewsSection.tsx`: course reviews
  - `CourseSummariesSection.tsx`: interactive course summaries
  - `CourseVideosSection.tsx`: course videos
  - `SubscribeModal.tsx`: enrollment modal

**Error handling / guards:**
- `AcademicOnboardingGate.tsx`: blocks access until onboarding completed
- `TRWAccessGate.tsx`: TRW access guard
- `ManageLecturesModal.tsx`: subject lecture management (ordering/keys/linking via `lecture_id`)
- `NotificationDropdown.tsx`: updated notification list with image support
- `ErrorBoundary.tsx`: app error handling with Arabic UI and production readiness
- `QueryProvider.tsx`: TanStack Query provider for client components

**UI components:**
- `/ui` folder: base components (Button, Card, Tabs, enhanced Input, Skeleton, etc.)

#### `/lib` - Libraries and helpers
- `supabase.ts`: Supabase setup and core operations
- `puter.ts`: Puter.js AI integration
- `cloudinary.ts`: upload management
- `analytics.ts`: usage tracking
- `performance.ts`: performance optimizations
- `session.ts`: session management
- `queryCache.ts`: query caching

#### `/types` - TypeScript types
- `database.ts`: auto-generated database types
- `generated-database.ts`: additional types

#### `/utils` - Utilities
- `notificationUtils.ts`: notification helpers

---

## Database Schema

### Core tables

#### `profiles` - User profiles
- Avatars and basic info
- `show_extra_assets` field to control extra assets visibility
- Linked to `auth.users`

#### `admins` - Admin management
- Separate table from auth metadata for better control.
- The platform is a template, so you must add admins manually in your own Supabase project.

#### `summaries` - Study summaries
- Rich content with PDF attachments
- Moderation workflow (pending → approved/rejected)
- Categorization by subject/department/year

#### `courses` - Courses
- Full course management with instructors
- Enrollment and metadata tracking
- Pricing support

#### `enrollments` - Student enrollments
- Student-course relationships with progress tracking
- Enrollment statuses (pending/active/expired)
- Payment proof workflow

#### `course_summaries`, `course_videos`, `course_files` - Course content
- Detailed course content management
- File/video attachments
- Access control based on enrollment

#### `quizzes` & `quiz_questions` - Quizzes
- Interactive assessment system
- Multiple question types and score recording
- Attempt tracking

#### `quiz_attempts` - Quiz attempts
- Tracks user attempts and results

#### `subject_lectures` - Subject lectures
- Linking based on `lecture_id` instead of only textual keys
- Source of truth for lecture ordering (`lecture_key`/`label`/`order_index`)

#### `user_progress` - User progress
- Stores completed items (summaries/videos/files/quizzes) and computes completion percentage

#### `chats`, `chat_messages`, `chat_participants` - Chat system
- Realtime chat for user communication
- AI chat history
- Group and 1:1 chat support

#### `ai_summaries`, `assistant_messages` - AI tracking
- Tracks AI conversations and summarization
- Performance metrics and usage analytics
- Session-based conversation management

#### `reviews`, `notifications`, `news` - Engagement & communication
- Course reviews and ratings
- Realtime notifications
- Admin-managed news

#### `appeals` - Appeals system
- Content moderation appeals
- Dispute resolution workflow

### Security and audit tables

#### `audit_logs` - Comprehensive audit logging
- Tracks user actions for compliance

#### `password_reset_tokens` - Secure password reset token management

### Storage buckets

#### `summaries-pdfs` - Public PDF bucket
- Public directory for PDF uploads
- Accepts PDFs only with size limits

#### `avatars` - Profile images
- With Cloudinary integration

#### `payment-proofs` - Payment proof documents
- Secure storage for payment verification documents

#### `course-materials` - Protected course materials
- Protected bucket for course content/resources
- Access control based on enrollment

#### `course-content` - Additional buckets for different content types with granular permissions

---

## External Services

### Supabase Edge Functions
- `upload-avatar`: upload profile images (Cloudinary) and link to the user
- `delete-avatar`: delete/cleanup profile images
- `upload-file`: upload a file (general/policy-based) with validation
- `delete-file`: securely delete a file
- `auth-hook-email`: handle auth events (hooks)
- `cloudinary-webhook`: receive Cloudinary webhooks
- `request-password-reset`: create secure password reset tokens
- `reset-password`: perform password reset
- `summarize-chat`: summarize chat/uploaded content

### Puter.js AI
- Browser SDK integration for smart study assistance.
- Supports chat history.
- Content analysis and summary generation.

### Cloudinary
- Image upload and processing
- Automatic image optimization
- Secure storage with signed URLs

### Brevo (Sendinblue)
- Advanced email notifications
- Email marketing campaign management
- Password reset and system notifications
- Email tracking and analytics
- Custom, programmable templates
- **Implementation note**: Supabase Auth emails (signup/recovery/magiclink/email_change) are sent via Edge Function `auth-hook-email` using the Brevo API.

---

## Security & Permissions

### Authentication
- Supabase Auth with email/password
- Google OAuth for fast onboarding
- JWT tokens for session management with automatic refresh

### Authorization
- Three roles: Student/Instructor/Admin
- Row Level Security (RLS) with 20+ security policies
- Dual role verification (metadata + database)

### Data security
- Encryption at rest (PostgreSQL encryption)
- Encryption in transit (HTTPS/TLS)
- Secure API key management

### Content security
- File type and size validation
- Automatic virus scanning
- Signed URLs for secure file access

---

## Development Workflow

### Local environment
```bash
pnpm install
pnpm dev  # development (http://localhost:3000)
pnpm build  # production build
pnpm start  # run production locally
```

### Database
```bash
npx supabase start  # local environment
npx supabase db reset  # reset database
npx supabase db remote commit  # production
```

### Requirements
- Node.js 18+
- Supabase account
- Puter.js integration
- Brevo account (Sendinblue) for auth emails
- Cloudinary keys

---

## Notes / Special Considerations

### Performance
- Lazy loading for pages with Next.js App Router
- Automatic code splitting with Next.js
- Query caching to reduce DB requests
- Image optimization with Next.js and Cloudinary

### UX
- Full Arabic RTL support
- Responsive (mobile-first) design
- PWA support for offline use
- Realtime notifications and live updates

### Maintainability
- TypeScript strict mode
- ESLint with React + accessibility rules
- Organized, reusable component structure
- Comprehensive database documentation

---

*Last updated: 07 April 2026*
*Developer: Masar X Team*

## Recent edits (April 2026)
- **Staging & Infra Updates**: Dependency/config updates and infrastructure updates (Sentry config, MCP route, UI components).
- **Next.js 16 Upgrade**: Upgrade to Next.js 16.2.1 and React 19.2.4 to improve performance and use modern features.
- **i18n Restructuring**: Restructured localization to use locale-based routing (`src/app/[locale]`) and centralized translation files in `src/messages/`.
- **AI Model Upgrade**: Updated the AI assistant to use **GPT-5 nano** with improved message rendering (Markdown/LaTeX), copy support, and raw view.
- **Drizzle ORM Integration**: Added Drizzle ORM for safer and more efficient DB access.
- **Middleware Relocation**: Moved `middleware.ts` to `src/lib/supabase/middleware.ts` to improve code organization.
- **Bug Investigation**: Thorough audit of the lectures system and identification of 13 issues with fix plans.

## Recent edits (March 2026)
- **Bug Investigation**: Comprehensive audit of lecture system identifying 13 bugs (3 critical, 6 medium, 4 minor) with detailed reports (BUG_REPORT_LECTURES.md, FIXES_PLAN.md).
- **Localization Completion**: Finalized not-found page localization with JSON-based translations, removed hardcoded strings.
- **Quiz System**: Enhanced QuizzesTab with search, sorting, pagination, and next-intl translations.
- **Localization Overhaul**: Completed full localization for `not-found`, `academic-onboarding`, and main pages using JSON-based translations.
- **TRW Subsystem**: Launched "The Road Within" architecture with membership gating and access code system.
- **Academic Flow**: Implemented `AcademicOnboardingGate` and migrated lecture linking to use `lecture_id` for better data integrity.
- **Build & SEO**: Switched to native `sitemap.ts`, fixed Vercel build errors related to null `created_at` and pre-rendering.
- **AI Improvements**: Added auto-trigger for Puter login when AI limits are reached and improved UI responsiveness.
- **Localization Sync**: Completed translations for all Admin Dashboard elements and Appeals system.
- **Hydration Strategy**: Applied `isMounted` checks in input forms to stabilize the UI.
- **Form Refactoring**: Refactored `AddFileForm` and `AddVideoForm` to improve performance and validation.
- **UI Optimization**: Improved responsiveness of `Header` and `MobileNav` and optimized the Courses page.

## Recent edits (21 Feb 2026)
- Frontend pages and components updated across `src/app/`
- New/backup Supabase migration SQL files added
- Security updates to password reset flow and storage policies

## Recent edits (16 Feb 2026)
- Refactored subject detail page to a lecture-first view with lecture sidebar and per-lecture filtered tabs in `src/app/subjects/[subject]/page.tsx`.

## Recent edits (19 Feb 2026)
- Aligned summaries flow with App Router routes: add/edit pages in `src/app/add-summary` and `src/app/edit-summary`, and details in `src/app/summaries/[summaryId]`.
- Admin dashboard now lives in `src/app/admin-dashboard` (tabs include subjects + manage lectures, summaries moderation, quizzes moderation, news, appeals, analytics, and doctor-only features).
- Platform active semester is managed via `usePlatformSettings` with DB + localStorage fallback.

## Recent edits (21 Feb 2026)
- Updated project context to reflect current dependencies.
- Deployment hardening notes synced with `vercel.json` (CSP + security headers) and `next.config.mjs` (restricted `next/image` remotePatterns + redirects `/admin` -> `/admin-dashboard`).
- Documented current auth email delivery path via Supabase Edge Function `supabase/functions/auth-hook-email` using **Brevo**.
