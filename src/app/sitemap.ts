import { MetadataRoute } from 'next'
import { supabase } from '../lib/supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://masarx.vercel.app'

  // Static URLs
  const staticUrls = [
    '',
    '/add',
    '/add-summary',
    '/add-video',
    '/add-file',
    '/ai-assistant',
    '/courses',
    '/faq',
    '/login',
    '/news',
    '/privacy',
    '/privacy-details',
    '/privacy-policy',
    '/quizzes',
    '/reset-password',
    '/signup',
    '/subjects',
    '/summaries',
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  // Dynamic URLs
  const dynamicUrls: MetadataRoute.Sitemap = []

  try {
    // Fetch subjects
    const { data: subjects } = await supabase
      .from('subjects')
      .select('name')

    if (subjects) {
      subjects.forEach(subject => {
        dynamicUrls.push({
          url: `${baseUrl}/subjects/${encodeURIComponent(subject.name).replace(/%20/g, '+')}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
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
          changeFrequency: 'weekly',
          priority: 0.7,
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
          changeFrequency: 'weekly',
          priority: 0.6,
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
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      })
    }
  } catch {
    // ignore - return static urls only if DB fails
  }

  return [...staticUrls, ...dynamicUrls]
}
