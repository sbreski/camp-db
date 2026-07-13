-- Step 48: Add additional adult relationship field for participant contacts.
-- Run in Supabase SQL Editor after previous migrations.

alter table public.participants
  add column if not exists parent2_relationship text;
