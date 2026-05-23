-- Step 35: Optional per-family pickup code overrides stored on participants.
-- Run in Supabase SQL Editor.

alter table public.participants
  add column if not exists pickup_code_overrides jsonb not null default '{}'::jsonb;
