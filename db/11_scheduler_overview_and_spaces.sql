-- Step 13: Scheduler upgrades (multi-staff, spaces, and overview sharing)
-- Run after Step 12.

alter table public.daily_timetable_entries
  add column if not exists assigned_emails text[] not null default '{}'::text[],
  add column if not exists space_name text,
  add column if not exists location_detail text;

create index if not exists daily_timetable_entries_assigned_emails_idx
  on public.daily_timetable_entries using gin (assigned_emails);

create index if not exists daily_timetable_entries_space_name_idx
  on public.daily_timetable_entries (space_name, day_date, start_time);

-- Backfill multi-staff array and space_name from existing fields.
update public.daily_timetable_entries
set assigned_emails = case
  when cardinality(assigned_emails) > 0 then assigned_emails
  when assigned_email is not null and btrim(assigned_email) <> '' then array[lower(assigned_email)]
  else '{}'::text[]
end,
space_name = coalesce(nullif(space_name, ''), nullif(location, ''));

create table if not exists public.timetable_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.timetable_spaces (name)
values
  ('Dance Space'),
  ('Drama Space'),
  ('bardepot'),
  ('Studio Theatre'),
  ('Art Space')
on conflict (name) do nothing;

alter table public.user_tab_permissions
  add column if not exists can_view_timetable_overview boolean not null default false;

create or replace function public.user_can_view_timetable_overview()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_tab_permissions p
    where p.user_id = auth.uid()
      and (p.is_admin = true or p.can_view_timetable_overview = true)
  );
$$;

grant execute on function public.user_can_view_timetable_overview() to authenticated;

alter table public.timetable_spaces enable row level security;

drop policy if exists "timetable spaces authenticated read" on public.timetable_spaces;
create policy "timetable spaces authenticated read"
on public.timetable_spaces for select
to authenticated
using (true);

drop policy if exists "timetable spaces admin write" on public.timetable_spaces;
create policy "timetable spaces admin write"
on public.timetable_spaces for all
to authenticated
using (public.user_is_admin())
with check (public.user_is_admin());

-- Replace timetable read/write policies with multi-staff + overview sharing logic.
drop policy if exists "daily timetable role-based read" on public.daily_timetable_entries;
drop policy if exists "daily timetable admin write" on public.daily_timetable_entries;

create policy "daily timetable role-based read"
on public.daily_timetable_entries for select
to authenticated
using (
  public.user_is_admin()
  or public.user_can_view_timetable_overview()
  or exists (
    select 1
    from unnest(coalesce(assigned_emails, '{}'::text[])) as staff_email
    where lower(staff_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  or lower(coalesce(assigned_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "daily timetable admin write"
on public.daily_timetable_entries for all
to authenticated
using (public.user_is_admin())
with check (public.user_is_admin());
