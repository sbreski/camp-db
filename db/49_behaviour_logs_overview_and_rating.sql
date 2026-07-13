-- Step 49: Add dedicated overview and rating fields for behaviour logs.
-- Run in Supabase SQL Editor after previous migrations.

alter table public.behaviour_logs
  add column if not exists overview text,
  add column if not exists rating text;

-- Backfill from legacy fields so existing entries are preserved in the new shape.
update public.behaviour_logs
set
  overview = coalesce(nullif(trim(overview), ''), nullif(trim(outcome), ''), nullif(trim(trigger_text), ''), nullif(trim(action_taken), '')),
  rating = case
    when rating in ('P', 'N', '-') then rating
    when category in ('P', 'N', '-') then category
    else '-'
  end;

alter table public.behaviour_logs
  alter column rating set default '-';

alter table public.behaviour_logs
  drop constraint if exists behaviour_logs_rating_check;

alter table public.behaviour_logs
  add constraint behaviour_logs_rating_check check (rating in ('P', 'N', '-'));
