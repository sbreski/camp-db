-- Step 22: Track incident submitter/updater user IDs for strict ownership checks.
-- Run in Supabase SQL Editor.

alter table public.incidents
  add column if not exists created_by_user_id uuid,
  add column if not exists updated_by_user_id uuid;