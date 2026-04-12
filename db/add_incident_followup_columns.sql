-- Run this in Supabase SQL Editor to enable cross-device follow-up syncing.

alter table public.incidents
  add column if not exists follow_up_required boolean not null default false,
  add column if not exists follow_up_due_date date,
  add column if not exists follow_up_completed_at timestamptz,
  add column if not exists follow_up_completed_by text;

-- Helpful index for next-day register prompts.
create index if not exists incidents_follow_up_due_idx
  on public.incidents (follow_up_due_date)
  where follow_up_required = true and follow_up_completed_at is null;
