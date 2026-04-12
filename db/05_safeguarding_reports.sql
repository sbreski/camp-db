-- Step 7: Safeguarding reports with restricted access.
-- Run in Supabase SQL Editor after previous migrations.

alter table public.participants
  add column if not exists safeguarding_flag boolean not null default false;

create table if not exists public.safeguarding_reports (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  report_name text not null,
  storage_path text not null,
  raised_by_user_id uuid,
  raised_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by_user_id uuid
);

create index if not exists safeguarding_reports_participant_idx
  on public.safeguarding_reports (participant_id, status, created_at desc);

create index if not exists safeguarding_reports_incident_idx
  on public.safeguarding_reports (incident_id);

create index if not exists safeguarding_reports_status_idx
  on public.safeguarding_reports (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_safeguarding_reports_updated_at on public.safeguarding_reports;
create trigger trg_safeguarding_reports_updated_at
before update on public.safeguarding_reports
for each row execute function public.set_updated_at();

alter table public.safeguarding_reports enable row level security;

-- No authenticated policies are created here on purpose.
-- Safeguarding reports should be accessed only through the server-side admin function.
