import { describe, expect, it } from 'vitest';
import {
  CourseSchema,
  ProfileSchema,
} from 'masarx-shared/types/schemas';

/**
 * Consumer-side contract tests for the shared zod schemas — the same
 * import path apps/web uses. They pin the shape the desktop/mobile
 * clients depend on, so a schema drift fails the web suite too.
 */

const validProfileRow = {
  id: '0d7a6c1e-1f2b-4c3d-8e9f-0a1b2c3d4e5f',
  username: 'student',
  full_name: 'طالب مسار',
  display_name: 'طالب',
  avatar_url: null,
  level: 2,
  semester: 4,
  department_id: null,
};

describe('masarx-shared ProfileSchema (DB row shape)', () => {
  it('accepts a valid profile row', () => {
    const result = ProfileSchema.safeParse(validProfileRow);
    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid id', () => {
    const result = ProfileSchema.safeParse({ ...validProfileRow, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing required column', () => {
    const { id: _dropped, ...missing } = validProfileRow;
    const result = ProfileSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer level', () => {
    const result = ProfileSchema.safeParse({ ...validProfileRow, level: 2.5 });
    expect(result.success).toBe(false);
  });
});

describe('masarx-shared CourseSchema', () => {
  const validCourseRow = {
    id: '0d7a6c1e-1f2b-4c3d-8e9f-0a1b2c3d4e5f',
    title: 'حاسبات',
    description: 'وصف الكورس',
    instructor_id: '0d7a6c1e-1f2b-4c3d-8e9f-0a1b2c3d4e5f',
    price: 0,
    is_published: false,
    is_academic: true,
    created_at: '2026-01-15T00:00:00Z',
  };

  it('accepts a valid course row (defaults applied)', () => {
    const result = CourseSchema.safeParse(validCourseRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(0);
      expect(result.data.is_published).toBe(false);
    }
  });

  it('rejects an unparseable created_at date', () => {
    const result = CourseSchema.safeParse({ ...validCourseRow, created_at: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});
