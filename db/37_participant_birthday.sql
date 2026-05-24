-- Step 37: Add participant birthday date field.
-- Run in Supabase SQL Editor.

alter table public.participants
  add column if not exists birthday date;
