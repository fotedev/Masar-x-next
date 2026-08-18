'use server';

import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
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
 * Resolves the subject UUID and (optionally) the lecture UUID for a given
 * subject name + lecture key combo. Returns nulls if not found.
 *
 * Casts results to `never` + explicit shape because Supabase JS v2.97's
 * generic inference resolves the admin client result to `never`.
 */
async function resolveSubjectAndLecture(
  subjectName: string,
  lectureKey: string | undefined,
): Promise<{ subjectId: string | null; lectureId: string | null }> {
  const admin = getSupabaseAdmin();

  const { data: subjectRows } = await admin
    .from('subjects')
    .select('id')
    .eq('name', subjectName)
    .limit(1);

  const subjectId = (subjectRows as { id: string }[] | null)?.[0]?.id ?? null;

  if (!lectureKey || !subjectId) {
    return { subjectId, lectureId: null };
  }

  const { data: lectureRows } = await admin
    .from('subject_lectures')
    .select('id')
    .eq('subject', subjectName)
    .eq('lecture_key', lectureKey)
    .limit(1);

  const lectureId = (lectureRows as { id: string }[] | null)?.[0]?.id ?? null;
  return { subjectId, lectureId };
}

/**
 * Adds a new file to a subject/lecture.
 *
 * Migrated from pg + Drizzle to Supabase JS service-role client.
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
    const admin = getSupabaseAdmin();
    const { subjectId, lectureId } = await resolveSubjectAndLecture(
      validated.data.subject,
      validated.data.lectureKey,
    );

    const { error: insertError } = await admin
      .from('files')
      .insert({
        id: crypto.randomUUID(),
        title: validated.data.title,
        subject: validated.data.subject,
        subject_id: subjectId,
        file_url: validated.data.fileUrl,
        description: validated.data.description || null,
        user_id: user!.id,
        lecture_key: validated.data.lectureKey || null,
        lecture_id: lectureId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never);

    if (insertError) throw insertError;

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
    const admin = getSupabaseAdmin();
    const { subjectId, lectureId } = await resolveSubjectAndLecture(
      validated.data.subject,
      validated.data.lectureKey,
    );

    const { error: insertError } = await admin
      .from('videos')
      .insert({
        id: crypto.randomUUID(),
        title: validated.data.title,
        subject: validated.data.subject,
        subject_id: subjectId,
        url: validated.data.url,
        language: validated.data.language,
        user_id: user!.id,
        lecture_key: validated.data.lectureKey || null,
        lecture_id: lectureId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never);

    if (insertError) throw insertError;

    revalidatePath(`/[locale]/subjects/${encodeURIComponent(validated.data.subject)}`, 'page');
    return { success: true, message: 'Video added successfully' };
  } catch (error) {
    console.error('Error adding video:', error);
    return { success: false, error: 'Internal server error' };
  }
}
