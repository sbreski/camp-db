-- Step 42: Add primary adult relationship field for participant contacts.
-- Run in Supabase SQL Editor.

alter table public.participants
  add column if not exists parent_relationship text;
