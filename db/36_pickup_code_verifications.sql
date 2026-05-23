-- Step 36: Optional short-lived pickup code pre-verification records per participant.
-- Run in Supabase SQL Editor.

alter table public.participants
  add column if not exists pickup_code_verifications jsonb not null default '{}'::jsonb;
