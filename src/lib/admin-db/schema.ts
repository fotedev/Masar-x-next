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

export type ProfileRow = typeof profiles.$inferSelect;
export type ProfileInsert = typeof profiles.$inferInsert;
