-- Step 9: Store account initials for attendance and form actions.
-- Run in Supabase SQL Editor after previous migrations.

alter table public.attendance
  add column if not exists sign_in_by text,
  add column if not exists sign_out_by text;

alter table public.incidents
  add column if not exists created_by_initials text,
  add column if not exists updated_by_initials text;

alter table public.documents
  add column if not exists uploaded_by_initials text;
