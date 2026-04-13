-- Step 23: Seasonal sign-in assignment flags for participants and staff.
-- Run in Supabase SQL Editor.

alter table public.participants
  add column if not exists is_active_this_season boolean;

alter table public.staff
  add column if not exists is_assigned_this_season boolean;

update public.participants
set is_active_this_season = true
where is_active_this_season is null;

update public.staff
set is_assigned_this_season = true
where is_assigned_this_season is null;

alter table public.participants
  alter column is_active_this_season set default true,
  alter column is_active_this_season set not null;

alter table public.staff
  alter column is_assigned_this_season set default true,
  alter column is_assigned_this_season set not null;
