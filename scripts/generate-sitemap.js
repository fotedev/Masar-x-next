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
  const baseUrl = 'https://masarx.vercel.app/';

  // Static URLs
  const staticUrls = [
    '',
    'add',
    'add-file',
    'add-summary',
    'add-video',
    'admin-dashboard',
    'ai-assistant',
    'courses',
    'edit-summary',
    'faq',
    'instructor-dashboard',
    'login',
    'news',
    'privacy',
    'privacy-details',
    'privacy-policy',
    'profile',
    'quiz-attempts',
    'quiz-play',
    'quizzes',
    'reset-password',
    'signup',
    'subjects',
    'summaries',
  ];

  // Dynamic URLs
  const dynamicUrls = [];

  try {
    // Fetch subjects
    const { data: subjects } = await supabase
    .from('subjects')
    .select('name');

    if (subjects) {
      subjects.forEach(subject => {
        dynamicUrls.push(`${baseUrl}subjects/${encodeURIComponent(subject.name)}`);
      });
    }

    // Fetch courses
    const { data: courses } = await supabase
      .from('courses')
      .select('id');

    if (courses) {
      courses.forEach(course => {
        dynamicUrls.push(`${baseUrl}courses/${course.id}`);
      });
    }

    // Fetch quizzes
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('id');

    if (quizzes) {
      quizzes.forEach(quiz => {
        dynamicUrls.push(`${baseUrl}quiz-play/${quiz.id}`);
      });
    }

    // Fetch summaries
    const { data: summaries } = await supabase
      .from('summaries')
      .select('id')
      .eq('status', 'approved');

    if (summaries) {
      summaries.forEach(summary => {
        dynamicUrls.push(`${baseUrl}summaries/${summary.id}`);
      });
    }
  } catch (error) {
    console.error('Error fetching data for sitemap:', error);
  }

  // Generate XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
  xml += '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n';

  [...staticUrls.map(route => `${baseUrl}${route}`), ...dynamicUrls].forEach(url => {
    xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>${url === baseUrl ? '1.0' : '0.8'}</priority>\n  </url>\n`;
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
