# Complete Setup Instructions

This guide will walk you through setting up the "Masar X" platform from scratch.

## Project Overview

"Masar X" is a crowdsourced platform for university students to share study summaries. It features:

- Public submission of summaries (no account needed)
- Admin moderation system
- PDF file uploads
- Arabic-first design with RTL support
- Responsive mobile-friendly interface

## Prerequisites

- Node.js 18+ and npm
- A Supabase project (already configured)
- A Cloudinary account for image/file uploads (see [CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md))

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages:
- React 18.3.1
- TypeScript 5.5.3
- Vite 5.4.2
- Tailwind CSS 3.4.1
- Supabase JS Client 2.57.4
- Lucide React 0.344.0

### 2. Environment Setup

The Supabase environment variables are already configured in your project:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

These are automatically available in the application.

### 3. Database Setup

The database is already set up with:

#### Tables:
- **summaries**: Stores all study summaries with moderation status

#### Storage:
- **summaries-pdfs**: Public bucket for PDF file uploads

#### Security:
- Row Level Security (RLS) is enabled
- Public users can view approved summaries and submit new ones
- Authenticated users can moderate all summaries

### 4. Sample Data

The database has been populated with sample summaries covering:
- Computer Science (Programming basics)
- Physics (Newton's laws)
- Mathematics (Differential equations)

### 5. Development Server

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 6. Create Admin User

To access the admin dashboard, you need to create an admin user.

Quick method:
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email and password
4. Check "Auto Confirm User"
5. Click "Create user"

## Project Structure

```
Masar X/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Header.tsx     # Navigation header
│   │   └── Layout.tsx     # Page layout wrapper
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx # Authentication state
│   ├── lib/               # Utilities and configs
│   │   └── supabase.ts    # Supabase client
│   ├── pages/             # Application pages
│   │   ├── HomePage.tsx           # Browse summaries
│   │   ├── AddSummaryPage.tsx     # Submit new summary
│   │   ├── SummaryDetailPage.tsx  # View full summary
│   │   ├── AdminDashboard.tsx     # Moderate summaries
│   │   └── LoginPage.tsx          # Admin login
│   ├── types/             # TypeScript types
│   │   └── database.ts    # Database schema types
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── index.html             # HTML template (RTL + Arabic)
├── README.md              # Project documentation
├── SETUP.md               # Complete setup guide
└── package.json           # Dependencies
```

## Features Walkthrough

### For Students (Public Users)

1. **Browse Summaries**
   - Visit home page
   - Use search bar to find specific topics
   - Filter by department, year, and subject
   - Click on any summary to view details

2. **Submit a Summary**
   - Click "إضافة ملخص" (Add Summary)
   - Fill in the form:
     - Title (required)
     - Department (required)
     - Year (required)
     - Subject (required)
     - Content (required)
     - PDF file (optional)
     - Your name (optional)
   - Click "إرسال الملخص" (Submit)
   - Summary will be pending until admin approval

3. **View Summary Details**
   - Click on any summary card
   - Read full content
   - Download PDF if available
   - See contributor name (if provided)

### For Admins (Authenticated Users)

1. **Login**
   - Click "دخول" (Login)
   - Enter admin credentials
   - Access admin dashboard

2. **Review Submissions**
   - View pending summaries
   - Read full content before approval

3. **Moderate Content**
   - **Approve**: Make summary visible to public
   - **Reject**: Hide summary from public view
   - **Edit**: Modify title or content before publishing
   - **Delete**: Permanently remove summary

4. **Manage All Content**
   - Switch between tabs:
     - قيد المراجعة (Pending)
     - موافق عليها (Approved)
     - مرفوضة (Rejected)
     - الكل (All)

## Building for Production

### Build the Project

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Deploy

The built files in `dist/` can be deployed to any static hosting service:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- AWS S3 + CloudFront

## Configuration

### Customization

#### Change Colors
Edit `tailwind.config.js` to customize the color scheme.

#### Change Font
Update `index.html` to use a different Arabic font from Google Fonts.

#### Add New Fields
1. Update database schema with migration
2. Update TypeScript types in `src/types/database.ts`
3. Update relevant components

### Performance Optimization

The project is already optimized with:
- Code splitting (Vite)
- Lazy loading
- Optimized images
- Minimal dependencies

## Troubleshooting

### Build Errors

**TypeScript errors:**
```bash
npm run typecheck
```

**Lint errors:**
```bash
npm run lint
```

### Runtime Errors

**Supabase connection issues:**
- Check browser console
- Verify environment variables
- Test Supabase connection in browser dev tools

**Authentication not working:**
- Verify admin user exists in Supabase
- Check email confirmation status
- Review RLS policies in Supabase

### Common Issues

**Can't submit summaries:**
- Check RLS policies allow INSERT for anonymous users
- Verify form validation is passing
- Check browser console for errors

**PDFs not uploading:**
- Verify storage bucket exists
- Check file size (should be under 10MB)
- Ensure file is a valid PDF

**Admin dashboard not showing summaries:**
- Verify user is authenticated
- Check RLS policies for authenticated users
- Look for JavaScript errors in console

## Next Steps

### Production Checklist

- [ ] Create admin users
- [ ] Test all features thoroughly
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure analytics (optional)
- [ ] Set up automated backups
- [ ] Review security settings
- [ ] Add custom domain
- [ ] Enable CDN for better performance
- [ ] Set up email notifications (future feature)

### Future Enhancements

Consider adding:
- User accounts for contributors
- Rating and review system
- Comments on summaries
- Search with full-text indexing
- Email notifications
- Export to different formats
- Mobile app (PWA)
- Multi-language support
- AI-powered summarization

## Support

For issues or questions:
1. Check the README.md
2. Review this SETUP.md guide
3. Check Supabase documentation
4. Review the code comments

## License

MIT License - Free to use and modify for your institution.
