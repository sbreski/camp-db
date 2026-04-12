-- Step 20: Shared dashboard notices editable by admin accounts.

create table if not exists public.dashboard_notices (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean not null default true,
  created_by_user_id uuid null default auth.uid(),
  updated_by_user_id uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_notices_active_idx
  on public.dashboard_notices (is_active, updated_at desc);

alter table public.dashboard_notices enable row level security;

create or replace function public.set_dashboard_notices_updated_at()
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

drop trigger if exists trg_dashboard_notices_updated_at on public.dashboard_notices;
create trigger trg_dashboard_notices_updated_at
before update on public.dashboard_notices
for each row execute function public.set_dashboard_notices_updated_at();

drop policy if exists "dashboard notices authenticated read" on public.dashboard_notices;
create policy "dashboard notices authenticated read"
on public.dashboard_notices for select
to authenticated
using (is_active = true or public.user_is_admin());

drop policy if exists "dashboard notices admin write" on public.dashboard_notices;
create policy "dashboard notices admin write"
on public.dashboard_notices for all
to authenticated
using (public.user_is_admin())
with check (public.user_is_admin());

grant select on public.dashboard_notices to authenticated;
grant insert, update, delete on public.dashboard_notices to authenticated;
