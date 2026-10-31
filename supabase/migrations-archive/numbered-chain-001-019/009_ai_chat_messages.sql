-- Spec 008 — track ai_chat_messages (chat persistence hardening)
--
-- DEFENSIVE: this table already exists out-of-band in prod (created via
-- dashboard edits, never migrated — the G3.9 drift class). Verified
-- 2026-09-18 by introspection: the live columns match this contract exactly
-- (id, user_id, role, content, mode, created_at; FK→auth.users cascade;
-- role CHECK; RLS enabled; 35 rows, all mode='cs_assistant').
-- On a fresh database every statement creates the full contract; on prod
-- each statement is a no-op or an additive fix (mode CHECK, composite index,
-- policies normalized to `to authenticated`).

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  mode text not null default 'cs_assistant',
  created_at timestamptz not null default now()
);

alter table public.ai_chat_messages enable row level security;

-- Owner-scoped policies; no anon access (anon never satisfies auth.uid(),
-- but the live policies were `to public` — normalized to `to authenticated`
-- per spec 008 §2). Dynamic drop loop: the out-of-band table's policy names
-- predate this migration, and re-runs must stay idempotent.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_chat_messages'
  loop
    execute format('drop policy if exists %I on public.ai_chat_messages', pol.policyname);
  end loop;
end $$;

create policy "Users can view their own chat messages"
  on public.ai_chat_messages for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own chat messages"
  on public.ai_chat_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own chat messages"
  on public.ai_chat_messages for delete
  to authenticated
  using (auth.uid() = user_id);

-- Prod table shipped without a mode CHECK (hook writes exactly these three
-- values); all live rows conform, verified 2026-09-18 before adding.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_chat_messages_mode_check'
      and conrelid = 'public.ai_chat_messages'::regclass
  ) then
    alter table public.ai_chat_messages
      add constraint ai_chat_messages_mode_check
      check (mode in ('cs_assistant', 'student_agent', 'group_rag'));
  end if;
end $$;

-- Composite index serving the load cap and prune (filter user+mode, order by
-- created_at). Supersedes the use case of the live single-column user_id
-- index; that index is left in place (non-destructive migration).
create index if not exists idx_ai_chat_user_mode_created
  on public.ai_chat_messages (user_id, mode, created_at);
