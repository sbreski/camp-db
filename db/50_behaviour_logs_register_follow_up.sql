-- Step 50: Add register follow-up flag to behaviour logs.
-- Run in Supabase SQL Editor after previous migrations.

alter table public.behaviour_logs
  add column if not exists follow_up_required boolean not null default false;

create index if not exists behaviour_logs_follow_up_required_idx
  on public.behaviour_logs (follow_up_required, logged_at desc);