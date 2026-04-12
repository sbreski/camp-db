-- Step 10: Role-based RLS hardening for production.
-- Run in Supabase SQL Editor after previous migrations.
--
-- This migration tightens write access based on user_tab_permissions and tab access.
-- It keeps attendance and incident logging available to authenticated staff,
-- while restricting sensitive writes (staff records, documents, participant profile edits).

-- Ensure RLS is enabled on all key tables.
alter table if exists public.participants enable row level security;
alter table if exists public.attendance enable row level security;
alter table if exists public.incidents enable row level security;
alter table if exists public.staff enable row level security;
alter table if exists public.documents enable row level security;

-- Helper: does the current user have admin permissions?
create or replace function public.user_is_admin()
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
      and p.is_admin = true
  );
$$;

-- Helper: does the current user have at least one of the provided tabs?
create or replace function public.user_has_any_tab(required_tabs text[])
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
      and (
        p.is_admin = true
        or p.allowed_tabs && required_tabs
      )
  );
$$;

grant execute on function public.user_is_admin() to authenticated;
grant execute on function public.user_has_any_tab(text[]) to authenticated;

-- Drop prior baseline policies so hardened policies can be recreated cleanly.
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

-- Participants
create policy "participants authenticated read"
on public.participants for select
to authenticated
using (deleted_at is null);

create policy "participants role-based write"
on public.participants for all
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['participants','parents','medical'])
)
with check (
  public.user_is_admin()
  or public.user_has_any_tab(array['participants','parents','medical'])
);

-- Attendance
create policy "attendance authenticated read"
on public.attendance for select
to authenticated
using (true);

create policy "attendance authenticated write"
on public.attendance for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- Incidents
create policy "incidents authenticated read"
on public.incidents for select
to authenticated
using (deleted_at is null);

create policy "incidents role-based write"
on public.incidents for all
to authenticated
using (
  auth.uid() is not null
  and (
    public.user_is_admin()
    or public.user_has_any_tab(array['incidents','signin'])
  )
)
with check (
  auth.uid() is not null
  and (
    public.user_is_admin()
    or public.user_has_any_tab(array['incidents','signin'])
  )
);

-- Staff (sensitive)
create policy "staff authenticated read"
on public.staff for select
to authenticated
using (deleted_at is null);

create policy "staff admin write"
on public.staff for all
to authenticated
using (public.user_is_admin())
with check (public.user_is_admin());

-- Documents metadata (sensitive)
create policy "documents role-based read"
on public.documents for select
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['documents'])
);

create policy "documents role-based write"
on public.documents for all
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['documents'])
)
with check (
  public.user_is_admin()
  or public.user_has_any_tab(array['documents'])
);

-- Optional: verify tab-permission table remains RLS-protected.
alter table if exists public.user_tab_permissions enable row level security;
