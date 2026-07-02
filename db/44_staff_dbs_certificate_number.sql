-- Step 44: Staff DBS certificate number field.
-- Run in Supabase SQL Editor.

alter table public.staff
  add column if not exists dbs_certificate_number text;

create index if not exists staff_dbs_certificate_number_idx
  on public.staff (dbs_certificate_number);
