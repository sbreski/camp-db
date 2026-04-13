-- Step 28: Central camp period settings for shared custom date ranges.
-- Run in Supabase SQL Editor.

create table if not exists public.camp_period_settings (
  id text primary key,
  start_date date not null,
  end_date date not null,
  updated_by_user_id uuid null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint camp_period_settings_date_order check (start_date <= end_date)
);

alter table public.camp_period_settings enable row level security;

create or replace function public.set_camp_period_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.updated_by_user_id is null then
    new.updated_by_user_id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_camp_period_settings_updated_at on public.camp_period_settings;
create trigger trg_camp_period_settings_updated_at
before update on public.camp_period_settings
for each row execute function public.set_camp_period_settings_updated_at();

drop policy if exists "camp period read" on public.camp_period_settings;
create policy "camp period read"
on public.camp_period_settings for select
to authenticated
using (true);

drop policy if exists "camp period write" on public.camp_period_settings;
create policy "camp period write"
on public.camp_period_settings for all
to authenticated
using (public.user_is_admin())
with check (public.user_is_admin());

grant select on public.camp_period_settings to authenticated;
grant insert, update, delete on public.camp_period_settings to authenticated;

insert into public.camp_period_settings (id, start_date, end_date)
values ('global', current_date, current_date)
on conflict (id) do nothing;
