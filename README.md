# Masar X - Comprehensive Learning Platform

Last updated: 12 March 2026

## Recent edits (12 Mar 2026)
- **Localization Completion**: Finalized localization for Admin Dashboard tabs, filters, and Appeals system reasons in English and Arabic.
- **Hydration & Stability**: Fixed hydration mismatches in client components using `isMounted` strategies.
- **Form Refactoring**: Refactored `AddFileForm` and `AddVideoForm` for better performance, removed legacy console logs, and improved validation.
- **UI & Performance**: Optimized `Courses` page with `useCallback` and improved layout responsiveness in `Header` and `MobileNav`.

## Recent edits (08 Mar 2026)
- **Bug Investigation**: Comprehensive audit of lecture system identifying 13 bugs (3 critical, 6 medium, 4 minor) with detailed reports and fix plans.
- **Localization Completion**: Finalized not-found page and academic-onboarding localization with JSON-based translations (ar/en).
- **Quiz System**: Enhanced QuizzesTab and quiz dashboard with improved search, sorting, and pagination.

## Recent edits (06 Mar 2026)
- **TRW Subsystem**: Launched "The Road Within" architecture with membership gating, plans (Free/Full/Money), and access code redemption.
- **Academic Onboarding**: Implemented `AcademicOnboardingGate` and mandatory specialization selection with advanced caching.
- **Localization Overhaul**: Completed full localization for `not-found`, `academic-onboarding`, and main pages using JSON-based translations.
- **Lecture Linking Migration**: Migrated subject lectures to use `lecture_id` for better data integrity and relationship management.
- **Build & SEO**: Switched to native `sitemap.ts`, fixed Vercel build errors, and hardened CSP headers for `masar-x.vercel.app`.
- **AI Improvements**: Added auto-trigger for Puter login on usage limit and improved UI responsiveness.

## Recent edits (09 Feb 2026)
- Multiple UI pages under `src/app/` updated (subjects, courses, quizzes, admin dashboard, AI assistant)
- Supabase migrations/backups added and security fixes applied
- Public manifest and PWA config adjusted
 

A modern, feature-rich educational platform for university students featuring study summaries, interactive courses, quizzes, AI-powered assistance, and comprehensive learning management tools.

## Security & Ops Work (Feb 2026)

### What was done

#### Next.js
- Restricted `next/image` remote domains (removed wildcard `**`).
- Removed global `force-dynamic` from the app root layout to restore caching/static optimization.

#### Client
- Removed console logs that printed whether Supabase env vars are set.

#### Supabase (DB)
- Added a unique index on `rate_limits(identifier, endpoint)` so `check_rate_limit` can safely use `ON CONFLICT`.
- Added `system_logs` table with RLS:
  - Authenticated users can insert.
  - Only admins can select.
  - Service role has full access.
- Added secure password-reset token support:
  - Added `token_hash` column + index on `password_reset_tokens`.
  - Backfilled `token_hash` from plaintext `token`.
- Restricted Supabase Storage uploads for `summaries-pdfs`:
  - Dropped anonymous insert policy.
  - Only authenticated users can upload.

#### Supabase (Edge Functions)
- `request-password-reset`:
  - Adds rate limiting (`check_rate_limit`) for password reset requests.
  - Stores `token_hash` (SHA-256) and also stores plaintext `token` temporarily for backwards compatibility.
- `delete-file`:
  - Enforces ownership by requiring `publicId` to start with `${user.id}_`.

### Files changed / added

#### App
- `next.config.mjs`
- `src/app/layout.tsx`
- `src/lib/supabase.ts`

#### Supabase migrations (new)
- `supabase/migrations/20260121054000_fix_rate_limits_unique.sql`
- `supabase/migrations/20260121054110_create_system_logs.sql`
- `supabase/migrations/20260121054220_add_token_hash_column.sql`
- `supabase/migrations/20260121054330_backfill_token_hash.sql`
- `supabase/migrations/20260121054500_restrict_storage_uploads.sql`

#### Supabase Edge Functions (changed)
- `supabase/functions/request-password-reset/index.ts`
- `supabase/functions/delete-file/index.ts`

### What you need to do

#### 1) Apply DB migrations
- Run the new migrations (local or remote) using your normal Supabase migration flow.
- Verify:
  - `rate_limits` has a unique constraint/index on `(identifier, endpoint)`.
  - `system_logs` exists and RLS policies behave as expected.
  - `password_reset_tokens.token_hash` exists and is populated.
  - Storage policy for `summaries-pdfs` no longer allows anonymous insert.

#### 2) Redeploy All Supabase Edge Functions
```bash
# إعادة نشر جميع وظائف Edge Functions
npx supabase functions deploy gemini-chat
npx supabase functions deploy upload-avatar
npx supabase functions deploy delete-avatar
npx supabase functions deploy upload-file
npx supabase functions deploy delete-file
npx supabase functions deploy auth-hook-email
npx supabase functions deploy cloudinary-webhook
npx supabase functions deploy request-password-reset
npx supabase functions deploy reset-password
npx supabase functions deploy summarize-chat
```

Or deploy all at once:
```bash
# إعادة نشر جميع الوظائف دفعة واحدة
for func in gemini-chat upload-avatar delete-avatar upload-file delete-file auth-hook-email cloudinary-webhook request-password-reset reset-password summarize-chat; do
  echo "Deploying $func..."
  npx supabase functions deploy $func
done
```

#### 3) Build and Start Application
```bash
# بناء التطبيق للإنتاج
npm run build

# تشغيل الخادم في وضع الإنتاج
npm run start
```

#### 4) Remaining security tasks (still pending)
- Update `supabase/functions/reset-password/index.ts` to verify/reset using `token_hash` (SHA-256) instead of plaintext `token`, then later remove plaintext token storage.
- Update `supabase/functions/upload-file/index.ts` to:
  - Require authentication (no guest uploads).
  - Enforce a MIME allowlist (e.g. pdf/jpeg/png/webp).
  - Remove environment-variable debug logging.


## Features

### Core Features
- **Study Summaries**: Crowdsourced platform for sharing and organizing academic summaries with PDF uploads
- **TRW (The Road Within)**: Advanced course system with membership plans, access codes, and progress tracking
- **Interactive Courses**: Complete course management with enrollment, reviews, and progress tracking
- **AI Assistant**: Powered by Google Gemini with Puter mode for extended usage and smart study assistance
- **Quizzes & Assessments**: Interactive quiz system with draft support and role-based permissions
- **Academic Onboarding**: Mandatory specialization setup to personalize the learning experience
- **Multi-Role System**: Student, Instructor, and Admin roles with comprehensive RLS security

### Learning Management
- **Course Catalog**: Browse and enroll in courses by subject, department, and instructor
- **Enrollment Management**: Secure enrollment with payment proof verification and status tracking
- **Progress Tracking**: Monitor learning progress and completion status
- **Review System**: Rate and review courses and instructors with detailed feedback
- **Course Content Management**: Comprehensive support for summaries, videos, and file materials per course
- **Instructor Dashboard**: Complete course creation and student management tools
- **Admin Course Oversight**: Platform-wide course management and analytics

### AI-Powered Features
- **Intelligent Chat**: AI assistant for answering questions and providing explanations
- **Smart Summarization**: AI-generated summaries and study aids
- **Personalized Learning**: Adaptive content recommendations
- **Conversation History**: Persistent chat sessions with AI summaries

### Administration
- **Admin Dashboard**: Comprehensive admin panel for platform management
- **Instructor Dashboard**: Course creation and student management tools
- **Content Moderation**: Review and approve user-generated content with appeals system
- **Analytics**: Platform usage and performance metrics with detailed reporting
- **User Management**: Role-based access control with granular permissions

### Communication & Collaboration
- **Real-time Notifications**: Live notification system for important updates
- **Chat System**: User-to-user messaging with AI integration
- **News & Announcements**: Admin-managed news and announcements system
- **Appeals System**: Content moderation appeals and dispute resolution

### Technical Features
- **Modern UI**: Responsive, mobile-first design with full Arabic RTL support
- **Real-time Updates**: Live notifications and instant content updates
- **Secure Architecture**: Row Level Security (RLS) policies for data protection
- **Performance Optimized**: Fast loading with modern web technologies and PWA support
- **SEO-Friendly**: Proper meta tags and semantic HTML structure
- **File Management**: Secure file uploads with Cloudinary integration
- **Email Integration**: EmailJS for notifications and password reset
- **Error Handling**: Advanced ErrorBoundary component with Arabic error messages
- **Content Organization**: Structured course content with ordering and categorization

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **State & Data**: TanStack Query (React Query) + React Context + Custom Hooks
- **Styling**: Tailwind CSS + Framer Motion for animations
- **Icons**: Lucide React
- **Backend**: Supabase (Database + Auth + Storage + Edge Functions)
- **Database**: PostgreSQL with 20+ migrations and advanced RLS policies
- **AI Integration**: Google Gemini API + Puter Integration
- **Email Services**: Brevo (Sendinblue) via Supabase Edge Functions
- **Math Rendering**: KaTeX for mathematical expressions
- **Deployment**: Vercel with native `sitemap.ts` and hardened CSP

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account and project
- Google Gemini API key (for AI features)
- EmailJS account (for email notifications)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd masarx_next
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory with the following variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://jcufigozkhxazjbwhjjm.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
   NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_emailjs_service_id
   NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
   NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret
   CLOUDINARY_URL=your_cloudinary_url
   ```

4. Set up the database:
   ```bash
   # For local development (requires Docker)
   npx supabase start
   npx supabase db reset

   # For production/remote database
   npx supabase db remote commit
   npx supabase db pull
   ```

### Current Admin Users

The platform currently has 2 active admin users:

1. **أحمد أبوالعيون** - ahmedaboalayoun0016k@gmail.com
2. **خالد "القائد"** - ksabry797@gmail.com

**Note:** Admin roles are managed through both the `admins` table and auth metadata. Use the admin dashboard to manage user roles and permissions.

### Development

Start the development server:
```bash
npm run dev
# or
pnpm dev
```

The application will be available at `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code quality checks

### Deployment

The project is configured for deployment on Vercel with optimized settings for performance and security.

## Usage

### For Students

1. **Browse Content**: Explore summaries, courses, and learning materials
2. **Enroll in Courses**: Join interactive courses with structured learning paths
3. **Take Quizzes**: Test your knowledge with interactive assessments
4. **AI Assistance**: Get help from the AI assistant for difficult topics
5. **Track Progress**: Monitor your learning journey and achievements
6. **Contribute Content**: Share study summaries and help other students

### For Instructors

1. **Create Courses**: Design and publish comprehensive courses
2. **Manage Students**: Track enrollment and student progress
3. **Create Quizzes**: Build assessments for your courses
4. **View Analytics**: Monitor course performance and student engagement

### For Admins

1. **Platform Management**: Oversee all platform operations and content
2. **User Management**: Manage user roles and permissions
3. **Content Moderation**: Review and approve user-generated content
4. **Analytics Dashboard**: Monitor platform usage and performance metrics
5. **System Configuration**: Configure platform settings and integrations

### Key Features Overview

- **Multi-language Support**: Full Arabic and English support with RTL layout
- **Responsive Design**: Mobile-first approach optimized for all device sizes
- **PWA Support**: Installable web app with offline capabilities
- **Accessibility**: WCAG compliant with comprehensive screen reader support
- **Performance**: Fast loading with code splitting, compression, and optimization
- **Security**: Enterprise-grade security with 20+ RLS policies and audit logging
- **Real-time Features**: Live notifications, chat, and instant updates
- **File Management**: Secure uploads with Cloudinary integration and access control
- **AI Integration**: Google Gemini-powered intelligent assistance and content generation

## Database Schema

The platform uses a comprehensive PostgreSQL database with 20+ tables, views, and advanced relationships built through 20+ migration files.

### Core Tables

#### `profiles`
- User profiles with avatars, display names, and preferences
- Linked to auth.users for authentication

#### `admins`
- Admin user management table
- Separate from auth metadata for better control
- Currently has 2 active admins

#### `summaries`
- Study summaries with rich content and PDF attachments
- Moderation workflow (pending → approved/rejected)
- Subject, department, and year categorization
- User ownership and audit trails

#### `courses`
- Complete course management with instructors
- Enrollment tracking and course metadata
- Pricing and payment integration support
- Publication status and content organization

#### `enrollments`
- Student-course relationships with progress tracking
- Enrollment status (pending/active/expired)
- Payment proof verification system

#### `course_summaries`, `course_videos`, `course_files`
- Detailed course content management
- File attachments and video content
- Access control based on enrollment

#### `quizzes` & `quiz_questions`
- Interactive assessment system
- Multiple question types and scoring
- Quiz attempts and results tracking

#### `chats`, `chat_messages`, `chat_participants`
- Real-time chat system for user communication
- AI assistant conversation history
- Group and individual chat support

#### `ai_summaries`, `assistant_messages`
- AI conversation tracking and summarization
- Performance metrics and usage analytics
- Session-based conversation management

#### `reviews`, `notifications`, `news`
- Course reviews and ratings system
- Real-time notification system
- Admin-managed announcements

#### `appeals`
- Content moderation appeals system
- Dispute resolution workflow

### Security & Audit Tables

#### `audit_logs`
- Comprehensive activity logging
- User action tracking for compliance

#### `password_reset_tokens`
- Secure password reset token management

#### `analytics`, `content_analytics`
- User behavior tracking and content performance
- Aggregated analytics for admin dashboard

### Storage Buckets

#### `summaries-pdfs`
- Public bucket for PDF uploads
- Accepts PDF files only with size limits

#### `avatars`
- User profile pictures with Cloudinary integration

#### `payment-proofs`
- Secure storage for payment verification documents

#### `course-materials`
- Protected bucket for course content and resources
- Enrollment-based access control

#### Additional buckets for various content types with granular permissions

## Security & Privacy

### Authentication & Authorization

- **Supabase Auth**: Secure authentication with email/password
- **Role-Based Access Control**: Student, Instructor, and Admin roles
- **JWT Tokens**: Secure session management with automatic refresh

### Data Protection

#### Row Level Security (RLS)
- **Public Access**: View approved content and public profiles
- **Student Access**: Enroll in courses, submit content, access enrolled materials
- **Instructor Access**: Create/manage courses, view student progress, create assessments
- **Admin Access**: Full platform management, user moderation, system configuration

#### Data Encryption
- **At Rest**: PostgreSQL encryption for sensitive data
- **In Transit**: HTTPS/TLS encryption for all communications
- **API Keys**: Secure environment variable management

### Content Security

#### File Upload Security
- **Type Validation**: Strict file type checking for uploads
- **Size Limits**: Configurable file size restrictions
- **Virus Scanning**: Automatic malware detection
- **Access Control**: Signed URLs for secure file access

#### Input Validation
- **Sanitization**: XSS prevention with input sanitization
- **SQL Injection**: Parameterized queries and prepared statements
- **Rate Limiting**: API rate limiting to prevent abuse

### Privacy Compliance

- **GDPR Ready**: Data minimization and user consent management
- **Data Retention**: Configurable data retention policies
- **Audit Logging**: Comprehensive activity logging for compliance
- **User Data Export**: Tools for data portability

## Recent Updates & Roadmap

### ✅ Recently Implemented (Latest Features)
- **TRW Subsystem**: New membership-based learning paths with plan-to-category mapping
- **Academic Onboarding**: `AcademicOnboardingGate` to ensure data consistency for students
- **Lecture Linking**: Improved lecture management using `lecture_id`
- **Advanced Course Management**: Complete course ecosystem with instructor dashboards and enrollment workflows
- **AI Puter Integration**: Support for Puter to extend AI assistant capabilities
- **Localization**: Full i18n support with JSON-based translations for AR/EN
- **Sitemap**: Automated SEO with `sitemap.ts`

### 🔄 Currently Active Features
- **Complete Course Management**: Full course creation, enrollment, and content management system
- **Payment Verification Workflow**: Secure enrollment with payment proof submission and admin approval
- **Course Content Organization**: Structured summaries, videos, and files for each course with ordering
- **Instructor Dashboard**: Comprehensive tools for course management and student oversight
- **Admin Analytics Dashboard**: Platform metrics, course analytics, and user behavior tracking
- **Advanced Search & Filtering**: Subject-based organization and content discovery
- **Email Integration**: Password reset and notification systems
- **Mobile-Responsive Design**: Optimized for all device sizes
- **Error Boundary Protection**: Application-wide error handling and recovery

### 📋 Future Enhancements
- **Certificate Generation**: Automated certificate creation for course completion
- **Video Content Integration**: Native video hosting and streaming capabilities
- **Peer-to-Peer Learning**: Study groups and collaborative features
- **Advanced AI Tutoring**: Personalized learning paths and adaptive assessments
- **Offline Synchronization**: Content availability without internet connection
- **External LMS Integration**: Compatibility with other learning management systems
- **Social Learning Features**: Community forums and study group management
- **Advanced Analytics**: Machine learning-driven insights and recommendations

## Development Guidelines

### Code Quality
- **TypeScript**: Strict type checking enabled
- **ESLint**: Comprehensive linting with React and accessibility rules
- **Pre-commit Hooks**: Automated code quality checks
- **Testing**: Comprehensive test coverage (in development)

### Architecture Principles
- **Component-Based**: Modular, reusable React components
- **Type Safety**: Full TypeScript coverage with strict types
- **Performance**: Optimized rendering with React best practices
- **Accessibility**: WCAG 2.1 AA compliance
- **Security First**: Secure coding practices and input validation

## Testing

### Developer Testing Tools

Masar X includes a comprehensive testing suite located in the `test_quiz/` directory to facilitate development and testing of the quiz system.

#### Available Test Scripts

- **`test-quiz-answers.js`** - Automated quiz completion with random answers
- **`test-quiz-navigation.js`** - Navigation and auto-save testing
- **`test-quiz-timer.js`** - Timer functionality and auto-completion testing
- **`test-quiz-bulk.js`** - Bulk testing with multiple concurrent attempts

#### Quick Start

```bash
cd test_quiz
npm install
node test-quiz-answers.js <quiz-id>
```

See `test_quiz/README.md` for detailed usage instructions.

## Contributing

We welcome contributions to Masar X! This is a production-ready platform serving thousands of students.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Contribution Guidelines

- Follow the existing code style and architecture
- Add tests for new features
- Update documentation for API changes
- Ensure accessibility compliance
- Test across different browsers and devices

### Development Setup

See the [Getting Started](#getting-started) section above for detailed setup instructions.

## API Documentation

The platform includes comprehensive Supabase Edge Functions for backend processing:

### Available Edge Functions
- **gemini-chat**: AI-powered chat processing with Google Gemini integration
- **upload-avatar**: Secure avatar upload with Cloudinary processing
- **delete-avatar**: Avatar deletion with cleanup
- **upload-file**: General file upload handling with validation
- **delete-file**: Secure file deletion
- **auth-hook-email**: Authentication event handling
- **cloudinary-webhook**: Cloudinary webhook processing
- **request-password-reset**: Secure password reset token generation
- **reset-password**: Password reset processing
- **summarize-chat**: AI-powered chat summarization

### Database Functions
- **get_admin_analytics_summary**: Comprehensive admin analytics aggregation
- **get_user_role**: User role checking utility

All functions include proper error handling, security validation, and CORS support.

## Deployment

### Vercel Deployment
The project is optimized for Vercel deployment with:
- Automatic builds and deployments
- Environment variable management
- Custom domain support
- Performance monitoring

### Environment Configuration
Production deployments require proper environment variable configuration for all external services.

## License

MIT License - feel free to use this project for your university or educational institution.

## Support

For support, feature requests, or bug reports:
- Create an issue on GitHub
- Contact the development team
- Check the documentation for common solutions

## Acknowledgments

- **Built with Modern Web Technologies**: Next.js 14, React 18, TypeScript, and Tailwind CSS for educational excellence
- **Designed for Arabic-Speaking Community**: Full RTL support and localized user experience
- **Powered by Leading Services**: Supabase backend, Google Gemini AI, and Cloudinary media processing
- **Production-Ready Platform**: Serving real users with enterprise-grade security and performance
- **Comprehensive Database Architecture**: 20+ migrations with advanced RLS policies and audit trails

### Current Platform Status
- **Active Users**: Live platform with registered users and active admins
- **Database**: Production PostgreSQL with comprehensive schema and security
- **Deployment**: Optimized for Vercel with PWA support and performance monitoring
- **Security**: Enterprise-grade authentication and authorization systems

### Development Team
The platform is actively maintained and developed with a focus on educational technology innovation and user experience.
