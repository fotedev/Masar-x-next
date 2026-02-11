# Complete Setup Instructions for Masar X
*آخر تحديث: 09 فبراير 2026*

## Recent edits (09 Feb 2026)
- Updated project pages and components in `src/app/` (multiple pages)
- Security & ops updates: DB migrations and Edge Functions (see "Security & Ops updates")
- Backups added for some Supabase migration SQL files
- Removed legacy Vite config and updated PWA/manifest files
 

This guide will walk you through setting up the "Masar X" comprehensive learning platform from scratch.

## Project Overview

"Masar X" is a modern, feature-rich educational platform designed for university students featuring:

- **Study Summaries**: Crowdsourced platform for sharing and organizing academic summaries with PDF uploads
- **Interactive Courses**: Complete course management with enrollment, reviews, and progress tracking
- **AI Assistant**: Powered by Google Gemini for intelligent study assistance and chat with conversation history
- **Quizzes & Assessments**: Interactive quiz system with multiple question types and scoring
- **Multi-Role System**: Student, Instructor, and Admin roles with comprehensive permission management
- **Real-time Features**: Live notifications, chat system, and instant content updates
- **Arabic-first Design**: Full RTL support with responsive mobile-friendly interface

## Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account and project
- Google Gemini API key (for AI features)
- EmailJS account (for email notifications)
- Cloudinary account (for file uploads)
- Git (for version control)

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd masarx_next
```

### 2. Install Dependencies

```bash
# Using npm
npm install

# Or using pnpm
pnpm install
```

This will install all required packages:
- Next.js 14.2.15
- React 18.3.1
- TypeScript 5.5.3
- Tailwind CSS 3.4.1
- Supabase JS Client 2.57.4
- Google Generative AI 0.24.1
- Lucide React 0.344.0
- KaTeX 0.16.27 (for math rendering)
- And many more...

### 3. Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
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

### 4. Database Setup

The platform uses a comprehensive PostgreSQL database with 20+ tables managed through Supabase.

#### For Local Development (Docker required):
```bash
npx supabase start
npx supabase db reset
```

#### For Production/Remote Database:
```bash
npx supabase db remote commit
npx supabase db pull
```

### Security & Ops updates (Feb 2026)
- أُجريت تحديثات أمنيّة وتشغيلية هامة — تأكد من تطبيقها في بيئتك:
  1. شغّل جميع الميجرِيشنز الجديدة (محلياً أو عن بُعد) للتأكد من وجود: قيد فريد على `rate_limits(identifier, endpoint)`, جدول `system_logs`, وعمود `token_hash` في `password_reset_tokens`.
  2. تأكد أن سياسة رفع الملفات لـ`summaries-pdfs` لم تعد تسمح بالرفع المجهول (فقط المستخدمون المصادقون).
  3. أعد نشر جميع Supabase Edge Functions بعد تطبيق الميجرِيشنز:
     ```bash
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
  4. اختبر سير عمل إعادة تعيين كلمة المرور والتأكد من أن `token_hash` يُستخدم بشكل صحيح قبل إزالة أي تخزين نصي للـtoken.
#### Database Schema Overview:
- **Core Tables**: `profiles`, `admins`, `summaries`, `courses`, `enrollments`, `quizzes`
- **Content Tables**: `course_summaries`, `course_videos`, `course_files`
- **Communication**: `chats`, `chat_messages`, `notifications`, `news`
- **AI Features**: `ai_summaries`, `assistant_messages`
- **Security**: `audit_logs`, `password_reset_tokens`
- **Analytics**: `analytics`, `content_analytics`

### 5. Sample Data

The database includes sample data for:
- Academic subjects and departments
- Sample courses with structured content
- Quiz questions and assessments
- User profiles and admin accounts

### 6. Development Server

Start the Next.js development server:

```bash
# Using npm
npm run dev

# Or using pnpm
pnpm dev
```

The application will be available at `http://localhost:3000`

### 7. Admin User Setup

Currently, the platform has 2 active admin users:

1. **أحمد أبو العلايون** - ahmedaboalayoun0016k@gmail.com
2. **خالد "القائد"** - ksabry797@gmail.com

**Note:** Admin roles are managed through both the `admins` table and auth metadata. Use the admin dashboard to manage user roles and permissions.

To create additional admin users:
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email and password
4. Check "Auto Confirm User"
5. Add the user to the `admins` table via SQL or admin dashboard

## Project Structure

```
masarx_next/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page
│   │   ├── login/               # Authentication pages
│   │   ├── admin/               # Admin dashboard
│   │   ├── courses/             # Course management
│   │   ├── quizzes/             # Quiz system
│   │   ├── ai-assistant/        # AI chat interface
│   │   └── api/                 # API routes
│   ├── components/              # Reusable UI components
│   │   ├── Header.tsx          # Navigation header
│   │   ├── QuizPlayer.tsx      # Quiz interface
│   │   ├── NotificationManager.tsx # Real-time notifications
│   │   ├── course/             # Course-specific components
│   │   └── ui/                 # UI component library
│   ├── contexts/               # React contexts
│   │   ├── AuthContext.tsx     # Authentication state
│   │   └── ThemeContext.tsx    # Theme management
│   ├── hooks/                  # Custom React hooks
│   │   ├── useQuizzes.ts       # Quiz management
│   │   ├── useCourses.ts       # Course operations
│   │   └── useNotifications.ts # Notification handling
│   ├── lib/                    # Utilities and configurations
│   │   ├── supabase.ts         # Supabase client setup
│   │   ├── gemini.ts           # Google Gemini AI integration
│   │   └── cloudinary.ts       # Cloudinary file management
│   ├── types/                  # TypeScript type definitions
│   │   ├── database.ts         # Database schema types
│   │   └── generated-database.ts # Auto-generated types
│   ├── constants/              # Application constants
│   │   ├── subjects.ts         # Academic subjects
│   │   └── notifications.ts    # Notification types
│   ├── utils/                  # Utility functions
│   └── index.css               # Global styles (Tailwind)
├── supabase/                   # Supabase configuration
│   ├── migrations/            # Database migrations (20+ files)
│   └── functions/             # Edge functions
├── test_quiz/                 # Quiz testing tools
├── public/                    # Static assets
│   ├── logo.png
│   └── manifest.json          # PWA manifest
├── README.md                  # Project documentation
├── SETUP.md                   # This setup guide
├── package.json               # Dependencies
├── next.config.mjs           # Next.js configuration
├── tailwind.config.js        # Tailwind CSS config
└── tsconfig.json             # TypeScript configuration
```

## Features Walkthrough

### For Students

1. **Browse Learning Content**
   - Explore summaries, courses, and quizzes from the home page
   - Use advanced search and filtering by subject, department, and year
   - Access AI-powered study assistant for help with difficult topics
   - View detailed content with PDF downloads and rich formatting

2. **Enroll in Courses**
   - Browse the course catalog with instructor information
   - Submit payment proofs for course enrollment
   - Track learning progress and completion status
   - Access structured course materials (summaries, videos, files)

3. **Take Interactive Quizzes**
   - Participate in assessments with multiple question types
   - Experience timed quizzes with auto-save functionality
   - Receive instant scoring and detailed feedback
   - Track quiz attempts and performance history

4. **AI-Powered Learning**
   - Chat with the AI assistant for explanations and help
   - Get personalized study recommendations
   - Access conversation history across sessions
   - Receive AI-generated summaries and study aids

5. **Contribute Content**
   - Submit study summaries with rich text and PDF uploads
   - Rate and review courses and instructors
   - Participate in the learning community
   - Share knowledge with fellow students

### For Instructors

1. **Course Management**
   - Create and publish comprehensive courses
   - Organize content with summaries, videos, and files
   - Set up quizzes and assessments for students
   - Manage course pricing and enrollment settings

2. **Student Oversight**
   - Track student enrollment and progress
   - View detailed analytics and engagement metrics
   - Review and respond to course feedback
   - Manage course content and materials

3. **Assessment Creation**
   - Build interactive quizzes with various question types
   - Set time limits and scoring configurations
   - Review student performance and quiz attempts
   - Provide feedback and grading

### For Admins

1. **Platform Management**
   - Access comprehensive admin dashboard
   - Manage user roles and permissions (Student/Instructor/Admin)
   - Oversee all platform content and users
   - Monitor system performance and analytics

2. **Content Moderation**
   - Review user-generated summaries and content
   - Approve or reject submissions with detailed feedback
   - Manage appeals and dispute resolution
   - Maintain content quality standards

3. **User Management**
   - View all registered users and their roles
   - Manage admin privileges and access control
   - Handle user authentication and password resets
   - Monitor user activity and engagement

4. **System Configuration**
   - Configure platform settings and integrations
   - Manage subjects, departments, and academic structure
   - Set up email notifications and communication
   - Oversee file storage and media management

5. **Analytics & Reporting**
   - Access detailed platform analytics
   - Monitor course performance and user engagement
   - Track quiz completion rates and scores
   - Generate reports for platform insights

## Building for Production

### Build the Project

```bash
# Using npm
npm run build

# Or using pnpm
pnpm build
```

This creates an optimized production build in the `.next/` directory with:
- Static asset optimization
- Code splitting and bundling
- Image optimization
- SEO enhancements

### Start Production Server

```bash
# Using npm
npm run start

# Or using pnpm
pnpm start
```

The application will be available at `http://localhost:3000`

### Deploy

The project is optimized for deployment on Vercel with:
- Automatic builds and deployments
- Environment variable management
- Custom domain support
- Performance monitoring
- Global CDN distribution

#### Alternative Deployment Options:
- **Vercel** (recommended) - One-click deployment
- **Netlify** - Static site hosting with Next.js support
- **Railway** - Full-stack deployment platform
- **AWS Amplify** - AWS-powered hosting
- **Self-hosted** - Docker deployment on any server

## Configuration

### Environment Variables

Ensure all required environment variables are set in `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Integration
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key

# Email Services
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_emailjs_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_emailjs_public_key

# File Storage
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
CLOUDINARY_URL=your_cloudinary_url
```

### Customization

#### Theme Customization
Edit `tailwind.config.js` to customize colors, fonts, and design tokens.

#### Arabic/RTL Support
The platform includes full RTL support with:
- Arabic font stacks optimized for readability
- RTL-aware component layouts
- Localized error messages and UI text

#### Add New Features
1. Update database schema with new migration in `supabase/migrations/`
2. Generate/update TypeScript types: `npx supabase gen types typescript --project-id your-project-id > src/types/generated-database.ts`
3. Create new components in appropriate directories
4. Update routing in `src/app/` directory

### Performance Optimization

The project includes comprehensive performance optimizations:
- **Next.js 14**: App Router with automatic optimization
- **Image Optimization**: Automatic WebP conversion and lazy loading
- **Code Splitting**: Automatic route-based and component splitting
- **Caching**: Intelligent caching strategies for static and dynamic content
- **PWA Support**: Service worker for offline functionality
- **SEO**: Meta tags, structured data, and performance monitoring

## Troubleshooting

### Development Issues

**Next.js Build Errors:**
```bash
# Type checking
npm run lint

# Build with verbose output
npm run build --verbose
```

**TypeScript Errors:**
```bash
# Type checking only
npx tsc --noEmit
```

### Runtime Errors

**Supabase Connection Issues:**
- Verify environment variables in `.env.local`
- Check Supabase project status and API keys
- Test connection using Supabase dashboard
- Review browser network tab for API calls

**Authentication Problems:**
- Ensure admin users exist in both `auth.users` and `admins` table
- Check email confirmation status in Supabase
- Verify RLS policies are correctly configured
- Test authentication flow in browser dev tools

**AI Assistant Not Working:**
- Verify Google Gemini API key is valid
- Check API quota and billing status
- Review browser console for API errors
- Test Gemini integration separately

### Database Issues

**Migration Problems:**
```bash
# Reset local database
npx supabase db reset

# Pull remote changes
npx supabase db pull
```

**RLS Policy Issues:**
- Check Supabase dashboard for policy configurations
- Ensure proper role-based access control
- Test policies with different user roles

### File Upload Issues

**Cloudinary Upload Failures:**
- Verify Cloudinary credentials and configuration
- Check file size limits (default: 10MB)
- Ensure proper file types are allowed
- Review Cloudinary dashboard for errors

**Storage Bucket Access:**
- Check Supabase storage bucket policies
- Verify file permissions and access control
- Test bucket access from Supabase dashboard

### Performance Issues

**Slow Loading:**
- Check browser network tab for large assets
- Verify image optimization is working
- Review Next.js build output for bundle sizes
- Test with browser developer tools performance tab

**Real-time Features Not Working:**
- Verify Supabase real-time is enabled
- Check WebSocket connections in network tab
- Test with different browsers/devices

## Testing & Quality Assurance

### Developer Testing Tools

Masar X includes comprehensive testing tools located in the `test_quiz/` directory:

#### Available Test Scripts:
- **`test-quiz-answers.js`** - Automated quiz completion testing
- **`test-quiz-navigation.js`** - Navigation and auto-save testing
- **`test-quiz-timer.js`** - Timer functionality testing
- **`test-quiz-bulk.js`** - Bulk testing with multiple attempts

#### Quick Start:
```bash
cd test_quiz
npm install
node test-quiz-answers.js <quiz-id>
```

See `test_quiz/README.md` for detailed usage instructions.

### Manual Testing Checklist

#### Core Features:
- [ ] User registration and authentication
- [ ] Summary submission and moderation
- [ ] Course enrollment and payment verification
- [ ] Quiz taking and scoring
- [ ] AI assistant chat functionality
- [ ] File uploads (PDFs, images, videos)
- [ ] Real-time notifications
- [ ] Admin dashboard functionality

#### User Roles:
- [ ] Student permissions and access
- [ ] Instructor course management
- [ ] Admin platform oversight

#### Mobile Responsiveness:
- [ ] Test on various screen sizes
- [ ] RTL layout verification
- [ ] Touch interactions
- [ ] PWA functionality

## Production Deployment Checklist

### Pre-Deployment:
- [ ] Set up production Supabase project
- [ ] Configure all environment variables
- [ ] Run database migrations
- [ ] Create production admin users
- [ ] Test all features in staging environment
- [ ] Set up error monitoring (Vercel Analytics, Sentry)
- [ ] Configure custom domain
- [ ] Set up SSL certificates

### Security Checklist:
- [ ] Review RLS policies for production
- [ ] Verify API key security
- [ ] Test authentication flows
- [ ] Check file upload restrictions
- [ ] Audit admin access controls
- [ ] Set up backup procedures

### Performance Optimization:
- [ ] Enable Vercel optimizations
- [ ] Configure CDN settings
- [ ] Test loading speeds
- [ ] Verify SEO implementation
- [ ] Check accessibility compliance

### Monitoring & Maintenance:
- [ ] Set up analytics tracking
- [ ] Configure error logging
- [ ] Set up automated testing
- [ ] Plan regular maintenance schedule
- [ ] Document admin procedures

## Future Enhancements Roadmap

### Currently Active Features:
- ✅ Advanced Course Management System
- ✅ AI-Powered Chat Assistant
- ✅ Comprehensive Quiz System
- ✅ Multi-Role User Architecture
- ✅ Real-time Communication
- ✅ Content Moderation & Appeals
- ✅ PWA Support & Mobile Optimization

### Planned Enhancements:
- **Certificate Generation**: Automated course completion certificates
- **Video Content Integration**: Native video hosting and streaming
- **Peer-to-Peer Learning**: Study groups and collaborative features
- **Advanced AI Tutoring**: Personalized learning paths and recommendations
- **Offline Synchronization**: Content availability without internet
- **External LMS Integration**: Compatibility with other learning platforms
- **Social Learning Features**: Community forums and discussion boards
- **Advanced Analytics**: Machine learning-driven insights
- **Mobile Applications**: Native iOS and Android apps
- **Multi-language Support**: Additional language localization

## Support & Resources

### Documentation:
1. **README.md** - Comprehensive project overview and features
2. **SETUP.md** - This complete setup guide
3. **test_quiz/README.md** - Quiz testing tools documentation
4. **PROJECT_CONTEXT.md** - Additional project context and requirements

### Getting Help:
- Check browser console for JavaScript errors
- Review Supabase dashboard for database issues
- Test API endpoints using Supabase documentation
- Check Vercel deployment logs for production issues
- Review GitHub issues for known problems

### Community Resources:
- **Supabase Documentation**: Database and authentication guides
- **Next.js Documentation**: Framework-specific help
- **Tailwind CSS**: Styling and component guidance
- **Google Gemini AI**: AI integration documentation

### Development Tools:
- **VS Code**: Recommended IDE with TypeScript support
- **Supabase CLI**: Database management and migrations
- **Vercel CLI**: Deployment and environment management
- **Browser DevTools**: Debugging and performance analysis

## License

MIT License - Free to use and modify for educational institutions and learning platforms.

## Acknowledgments

Built with modern web technologies for the Arabic-speaking academic community:
- **Next.js 14** - React framework for production
- **Supabase** - Backend-as-a-Service platform
- **Google Gemini** - AI-powered assistance
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Type-safe development

The platform serves as a comprehensive learning management system designed specifically for university students in the Arab world, featuring full RTL support and localized user experience.
