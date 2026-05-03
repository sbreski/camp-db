-- Step 31: Staff training fields (first aid + safeguarding).
-- Run in Supabase SQL Editor.

alter table public.staff
  add column if not exists first_aid_trained boolean not null default false,
  add column if not exists safeguarding_trained boolean not null default false,
  add column if not exists first_aid_expires_on date,
  add column if not exists safeguarding_expires_on date;

create index if not exists staff_first_aid_expires_on_idx
  on public.staff (first_aid_expires_on);

create index if not exists staff_safeguarding_expires_on_idx
  on public.staff (safeguarding_expires_on);
