'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminDb } from '@/lib/admin-db';
import { files, videos, subjectLectures, subjects } from '@/lib/admin-db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Validation schemas
const addFileSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  subject: z.string(),
  fileUrl: z.string().url("Invalid file URL"),
  description: z.string().optional(),
  lectureKey: z.string().optional(),
});

const addVideoSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  subject: z.string(),
  url: z.string().url("Invalid video URL"),
  language: z.enum(['ar', 'en']).default('ar'),
  lectureKey: z.string().optional(),
});

/**
 * Common security check for admin/instructor roles
 */
async function ensureAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: 'Not authenticated' };

  const role = user.app_metadata?.role;
  const isAdmin = role === 'admin' || role === 'doctor' || role === 'student_admin';
  
  if (!isAdmin) return { user, error: 'Not authorized' };
  return { user, error: null };
}

/**
 * Adds a new file to a subject/lecture.
 */
export async function addFile(_prevState: any, formData: FormData) {
  const { user, error: authError } = await ensureAdmin();
  if (authError) return { success: false, error: authError };

  const rawData = {
    title: formData.get('title') as string,
    subject: formData.get('subject') as string,
    fileUrl: formData.get('fileUrl') as string,
    description: formData.get('description') as string,
    lectureKey: formData.get('lectureKey') as string,
  };

  const validated = addFileSchema.safeParse(rawData);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  try {
    const adminDb = getAdminDb();
    
    // 1. Resolve subject and lecture IDs
    const [subject] = await adminDb.select().from(subjects).where(eq(subjects.name, validated.data.subject)).limit(1);
    let lectureId = null;
    
    if (validated.data.lectureKey && subject) {
      const [lecture] = await adminDb.select().from(subjectLectures).where(
        and(
          eq(subjectLectures.subject, validated.data.subject),
          eq(subjectLectures.lectureKey, validated.data.lectureKey)
        )
      ).limit(1);
      lectureId = lecture?.id || null;
    }

    // 2. Insert record
    await adminDb.insert(files).values({
      id: crypto.randomUUID(),
      title: validated.data.title,
      subject: validated.data.subject,
      subjectId: subject?.id || null,
      fileUrl: validated.data.fileUrl,
      description: validated.data.description || null,
      userId: user!.id,
      lectureKey: validated.data.lectureKey || null,
      lectureId: lectureId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/[locale]/subjects/${encodeURIComponent(validated.data.subject)}`, 'page');
    return { success: true, message: 'File added successfully' };
  } catch (error) {
    console.error('Error adding file:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Adds a new video to a subject/lecture.
 */
export async function addVideo(_prevState: any, formData: FormData) {
  const { user, error: authError } = await ensureAdmin();
  if (authError) return { success: false, error: authError };

  const rawData = {
    title: formData.get('title') as string,
    subject: formData.get('subject') as string,
    url: formData.get('url') as string,
    language: formData.get('language') as 'ar' | 'en',
    lectureKey: formData.get('lectureKey') as string,
  };

  const validated = addVideoSchema.safeParse(rawData);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  try {
    const adminDb = getAdminDb();
    
    const [subject] = await adminDb.select().from(subjects).where(eq(subjects.name, validated.data.subject)).limit(1);
    let lectureId = null;
    
    if (validated.data.lectureKey && subject) {
      const [lecture] = await adminDb.select().from(subjectLectures).where(
        and(
          eq(subjectLectures.subject, validated.data.subject),
          eq(subjectLectures.lectureKey, validated.data.lectureKey)
        )
      ).limit(1);
      lectureId = lecture?.id || null;
    }

    await adminDb.insert(videos).values({
      id: crypto.randomUUID(),
      title: validated.data.title,
      subject: validated.data.subject,
      subjectId: subject?.id || null,
      url: validated.data.url,
      language: validated.data.language,
      userId: user!.id,
      lectureKey: validated.data.lectureKey || null,
      lectureId: lectureId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    revalidatePath(`/[locale]/subjects/${encodeURIComponent(validated.data.subject)}`, 'page');
    return { success: true, message: 'Video added successfully' };
  } catch (error) {
    console.error('Error adding video:', error);
    return { success: false, error: 'Internal server error' };
  }
}
