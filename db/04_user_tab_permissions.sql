-- Step 6: Per-user tab permissions
-- Run in Supabase SQL Editor.

create table if not exists public.user_tab_permissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  allowed_tabs text[] not null default array['dashboard','signin']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_tab_permissions_is_admin_idx
  on public.user_tab_permissions (is_admin);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_tab_permissions_updated_at on public.user_tab_permissions;
create trigger trg_user_tab_permissions_updated_at
before update on public.user_tab_permissions
for each row execute function public.set_updated_at();

alter table public.user_tab_permissions enable row level security;

drop policy if exists "user tab permissions self read" on public.user_tab_permissions;
create policy "user tab permissions self read"
on public.user_tab_permissions for select
to authenticated
using (auth.uid() = user_id);

grant select on table public.user_tab_permissions to authenticated;
