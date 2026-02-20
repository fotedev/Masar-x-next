import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateSitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://masar-x.vercel.app';

  // Static URLs
  const staticUrls = [
    '',
    '/add',
    '/add-summary',
    '/admin-dashboard',
    '/ai-assistant',
    '/courses',
    '/edit-summary',
    '/instructor-dashboard',
    '/login',
    '/news',
    '/privacy',
    '/privacy-details',
    '/privacy-policy',
    '/profile',
    '/quiz-attempts',
    '/quiz-play',
    '/quizzes',
    '/reset-password',
    '/signup',
    '/subjects',
    '/summaries',
    '/test-route',
  ];

  // Dynamic URLs
  const dynamicUrls = [];

  try {
    // Fetch subjects
    const { data: subjects } = await supabase
      .from('subjects')
      .select('name')
      .eq('show_on_home', true);

    if (subjects) {
      subjects.forEach(subject => {
        dynamicUrls.push(`${baseUrl}/subjects/${encodeURIComponent(subject.name)}`);
      });
    }

    // Fetch courses
    const { data: courses } = await supabase
      .from('courses')
      .select('id');

    if (courses) {
      courses.forEach(course => {
        dynamicUrls.push(`${baseUrl}/courses/${course.id}`);
      });
    }

    // Fetch quizzes
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('id');

    if (quizzes) {
      quizzes.forEach(quiz => {
        dynamicUrls.push(`${baseUrl}/quiz-play/${quiz.id}`);
      });
    }

    // Fetch summaries
    const { data: summaries } = await supabase
      .from('summaries')
      .select('id')
      .eq('status', 'approved');

    if (summaries) {
      summaries.forEach(summary => {
        dynamicUrls.push(`${baseUrl}/summaries/${summary.id}`);
      });
    }
  } catch (error) {
    console.error('Error fetching data for sitemap:', error);
  }

  // Generate XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  [...staticUrls.map(route => `${baseUrl}${route}`), ...dynamicUrls].forEach(url => {
    xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n  </url>\n`;
  });

  xml += '</urlset>\n';

  return xml;
}

async function main() {
  const xml = await generateSitemap();
  const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
  fs.writeFileSync(outputPath, xml);
  console.log('Sitemap generated at public/sitemap.xml');
}

main().catch(console.error);
