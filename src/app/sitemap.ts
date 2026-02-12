import { MetadataRoute } from 'next'
import { supabase } from '../lib/supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://masar-x.vercel.app/'

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
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
  }))

  // Dynamic URLs
  const dynamicUrls: MetadataRoute.Sitemap = []

  try {
    // Fetch subjects
    const { data: subjects } = await supabase
      .from('subjects')
      .select('name')
      .eq('show_on_home', true)

    if (subjects) {
      subjects.forEach(subject => {
        dynamicUrls.push({
          url: `${baseUrl}/subjects/${encodeURIComponent(subject.name)}`,
          lastModified: new Date(),
        })
      })
    }

    // Fetch courses
    const { data: courses } = await supabase
      .from('courses')
      .select('id, updated_at')

    if (courses) {
      courses.forEach(course => {
        dynamicUrls.push({
          url: `${baseUrl}/courses/${course.id}`,
          lastModified: new Date(course.updated_at),
        })
      })
    }

    // Fetch quizzes
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('id, updated_at')

    if (quizzes) {
      quizzes.forEach(quiz => {
        dynamicUrls.push({
          url: `${baseUrl}/quiz-play/${quiz.id}`,
          lastModified: new Date(quiz.updated_at),
        })
      })
    }

    // Fetch summaries
    const { data: summaries } = await supabase
      .from('summaries')
      .select('id, updated_at')
      .eq('status', 'approved')

    if (summaries) {
      summaries.forEach(summary => {
        dynamicUrls.push({
          url: `${baseUrl}/summaries/${summary.id}`,
          lastModified: new Date(summary.updated_at),
        })
      })
    }
  } catch {
    // ignore
  }

  return [...staticUrls, ...dynamicUrls]
}
