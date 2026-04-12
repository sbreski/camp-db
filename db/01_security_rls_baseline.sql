-- Step 3: Security baseline for Supabase
-- Run in Supabase SQL Editor.

-- Enable RLS on app tables.
alter table if exists public.participants enable row level security;
alter table if exists public.attendance enable row level security;
alter table if exists public.incidents enable row level security;
alter table if exists public.staff enable row level security;
alter table if exists public.documents enable row level security;

-- Replace permissive policies if they already exist.
drop policy if exists "participants authenticated read" on public.participants;
drop policy if exists "participants authenticated write" on public.participants;
drop policy if exists "attendance authenticated read" on public.attendance;
drop policy if exists "attendance authenticated write" on public.attendance;
drop policy if exists "incidents authenticated read" on public.incidents;
drop policy if exists "incidents authenticated write" on public.incidents;
drop policy if exists "staff authenticated read" on public.staff;
drop policy if exists "staff authenticated write" on public.staff;
drop policy if exists "documents authenticated read" on public.documents;
drop policy if exists "documents authenticated write" on public.documents;

-- Temporary baseline: all authenticated staff users can read/write.
-- Tighten these with role-based policies in a later phase.
create policy "participants authenticated read"
on public.participants for select
to authenticated
using (true);

create policy "participants authenticated write"
on public.participants for all
to authenticated
using (true)
with check (true);

create policy "attendance authenticated read"
on public.attendance for select
to authenticated
using (true);

create policy "attendance authenticated write"
on public.attendance for all
to authenticated
using (true)
with check (true);

create policy "incidents authenticated read"
on public.incidents for select
to authenticated
using (true);

create policy "incidents authenticated write"
on public.incidents for all
to authenticated
using (true)
with check (true);

create policy "staff authenticated read"
on public.staff for select
to authenticated
using (true);

create policy "staff authenticated write"
on public.staff for all
to authenticated
using (true)
with check (true);

create policy "documents authenticated read"
on public.documents for select
to authenticated
using (true);

create policy "documents authenticated write"
on public.documents for all
to authenticated
using (true)
with check (true);
