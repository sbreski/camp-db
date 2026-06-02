-- Step 41: Add support for additional adult contacts and home phone numbers.
-- Run in Supabase SQL Editor.

alter table public.participants
  add column if not exists parent2_name text,
  add column if not exists parent2_email text,
  add column if not exists parent2_phone text,
  add column if not exists home_phone text;
