-- Step 24: Track safeguarding resolution separately from follow-up completion.
-- Run in Supabase SQL Editor.

alter table public.incidents
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by text;
