import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
  username: text('username'),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  website: text('website'),
  level: integer('level'),
  semester: integer('semester'),
  departmentId: text('department_id'),
  showExtraAssets: boolean('show_extra_assets'),
  showExtraAssetsUpdatedAt: timestamp('show_extra_assets_updated_at', {
    withTimezone: true,
    mode: 'string',
  }),
});

export const subjects = pgTable('subjects', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  professor: text('professor'),
  level: integer('level'),
  semester: integer('semester'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const subjectLectures = pgTable('subject_lectures', {
  id: text('id').primaryKey().notNull(),
  subject: text('subject').notNull(),
  lectureKey: text('lecture_key').notNull(),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const videos = pgTable('videos', {
  id: text('id').primaryKey().notNull(),
  subject: text('subject'),
  subjectId: text('subject_id').references(() => subjects.id),
  title: text('title').notNull(),
  url: text('url').notNull(),
  language: text('language').default('ar'),
  userId: text('user_id'),
  lectureKey: text('lecture_key'),
  lectureId: text('lecture_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const files = pgTable('files', {
  id: text('id').primaryKey().notNull(),
  subject: text('subject'),
  subjectId: text('subject_id').references(() => subjects.id),
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  description: text('description'),
  userId: text('user_id'),
  lectureKey: text('lecture_key'),
  lectureId: text('lecture_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const summaries = pgTable('summaries', {
  id: text('id').primaryKey().notNull(),
  title: text('title').notNull(),
  content: text('content'),
  fileUrl: text('file_url'),
  subjectId: text('subject_id').references(() => subjects.id),
  userId: text('user_id'),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});

export const admins = pgTable('admins', {
  userId: text('user_id').primaryKey().notNull(),
  role: text('role'),
  grantedBy: text('granted_by'),
  grantedAt: timestamp('granted_at', { withTimezone: true, mode: 'string' }),
  notes: text('notes'),
});

export type ProfileRow = typeof profiles.$inferSelect;
export type ProfileInsert = typeof profiles.$inferInsert;
