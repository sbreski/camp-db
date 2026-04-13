-- Step 27: Star of the Day recognition matrix and access policies.
-- Run in Supabase SQL Editor.

create table if not exists public.star_of_day_awards (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  award_date date not null,
  created_by_user_id uuid null default auth.uid(),
  updated_by_user_id uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint star_of_day_awards_unique_participant_day unique (participant_id, award_date)
);

create index if not exists star_of_day_awards_award_date_idx
  on public.star_of_day_awards (award_date desc);

create index if not exists star_of_day_awards_participant_idx
  on public.star_of_day_awards (participant_id, award_date desc);

alter table public.star_of_day_awards enable row level security;

create or replace function public.set_star_of_day_awards_updated_at()
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

drop trigger if exists trg_star_of_day_awards_updated_at on public.star_of_day_awards;
create trigger trg_star_of_day_awards_updated_at
before update on public.star_of_day_awards
for each row execute function public.set_star_of_day_awards_updated_at();

drop policy if exists "star of day read" on public.star_of_day_awards;
create policy "star of day read"
on public.star_of_day_awards for select
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['star-of-day'])
);

drop policy if exists "star of day write" on public.star_of_day_awards;
create policy "star of day write"
on public.star_of_day_awards for all
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['star-of-day'])
)
with check (
  public.user_is_admin()
  or public.user_has_any_tab(array['star-of-day'])
);

grant select on public.star_of_day_awards to authenticated;
grant insert, update, delete on public.star_of_day_awards to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'star_of_day_awards'
  ) then
    alter publication supabase_realtime add table public.star_of_day_awards;
  end if;
end
$$;
