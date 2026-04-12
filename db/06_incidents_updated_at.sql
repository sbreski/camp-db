-- Step 8: Track incident edits with updated_at.
-- Run in Supabase SQL Editor after previous migrations.

alter table public.incidents
  add column if not exists updated_at timestamptz not null default now();

create index if not exists incidents_updated_at_idx
  on public.incidents (updated_at desc);

create or replace function public.set_incidents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_incidents_updated_at on public.incidents;
create trigger trg_incidents_updated_at
before update on public.incidents
for each row execute function public.set_incidents_updated_at();
