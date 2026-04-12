-- Step 5: Soft delete for participants, incidents, and staff
-- Run in Supabase SQL Editor after Step 3/4.

alter table if exists public.participants
  add column if not exists deleted_at timestamptz;

alter table if exists public.incidents
  add column if not exists deleted_at timestamptz;

alter table if exists public.staff
  add column if not exists deleted_at timestamptz;

create index if not exists participants_deleted_at_idx on public.participants (deleted_at);
create index if not exists incidents_deleted_at_idx on public.incidents (deleted_at);
create index if not exists staff_deleted_at_idx on public.staff (deleted_at);

-- Ensure authenticated reads only return active rows for soft-delete tables.
drop policy if exists "participants authenticated read" on public.participants;
create policy "participants authenticated read"
on public.participants for select
to authenticated
using (deleted_at is null);

drop policy if exists "incidents authenticated read" on public.incidents;
create policy "incidents authenticated read"
on public.incidents for select
to authenticated
using (deleted_at is null);

drop policy if exists "staff authenticated read" on public.staff;
create policy "staff authenticated read"
on public.staff for select
to authenticated
using (deleted_at is null);
