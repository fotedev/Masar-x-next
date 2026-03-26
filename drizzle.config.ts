import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/admin-db/schema.ts',
  out: './supabase/migrations.drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
  strict: true,
});
