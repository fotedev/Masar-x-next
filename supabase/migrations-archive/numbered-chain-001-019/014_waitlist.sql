-- 014_waitlist.sql: Email waitlist for TRW & platform release notifications (spec 021)
-- Sources: 'trw' (footer card), 'macos'/'android' (/downloads ComingSoonCards).
-- Insert-only from clients: RLS grants INSERT only, no SELECT/UPDATE/DELETE.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(email) <= 254),
  source text not null check (source in ('trw', 'macos', 'android')),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Case-insensitive deduplication per source
create unique index waitlist_email_source_unique on public.waitlist (lower(email), source);

-- RLS: insert-only from client (no public read/update/delete)
alter table public.waitlist enable row level security;

create policy waitlist_insert_any on public.waitlist
  for insert to anon, authenticated
  with check (true);
