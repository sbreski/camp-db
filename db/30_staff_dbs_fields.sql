-- Step 30: Staff DBS tracking fields.
-- Run in Supabase SQL Editor.

alter table public.staff
  add column if not exists dbs_on_update_service boolean not null default false,
  add column if not exists dbs_issue_date date;

create index if not exists staff_dbs_issue_date_idx
  on public.staff (dbs_issue_date);
