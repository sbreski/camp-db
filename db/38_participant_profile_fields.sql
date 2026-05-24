-- Step 38: Add additional participant profile fields from parent signup form.
-- Run in Supabase SQL Editor.

alter table public.participants
  add column if not exists address text,
  add column if not exists postcode text,
  add column if not exists school_attending text,
  add column if not exists siblings boolean,
  add column if not exists siblings_name text;
