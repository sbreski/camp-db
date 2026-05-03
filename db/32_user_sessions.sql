-- Step 32: Server-side user session expiry tracking.
-- Stores a single row per user with when their session expires (absolute 12-hour window).
-- This allows the expiry to be shared across all devices for the same user account.
-- Run in Supabase SQL Editor.

create table if not exists public.user_sessions (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.user_sessions enable row level security;

-- Each authenticated user can read, write, and delete their own row.
create policy "user_sessions: user can select own"
  on public.user_sessions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_sessions: user can insert own"
  on public.user_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_sessions: user can update own"
  on public.user_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_sessions: user can delete own"
  on public.user_sessions for delete
  to authenticated
  using (auth.uid() = user_id);
