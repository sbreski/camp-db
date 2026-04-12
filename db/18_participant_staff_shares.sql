-- Step 18: Targeted participant information sharing for staff briefings.

create table if not exists public.participant_staff_shares (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('send', 'allergy', 'medical', 'dietary')),
  summary text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by_user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participant_staff_shares_target_idx
  on public.participant_staff_shares (target_user_id, status, updated_at desc);

create index if not exists participant_staff_shares_participant_idx
  on public.participant_staff_shares (participant_id, status, updated_at desc);

create index if not exists participant_staff_shares_category_idx
  on public.participant_staff_shares (category);

alter table public.participant_staff_shares enable row level security;

create or replace function public.set_participant_staff_shares_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_participant_staff_shares_updated_at on public.participant_staff_shares;
create trigger trg_participant_staff_shares_updated_at
before update on public.participant_staff_shares
for each row execute function public.set_participant_staff_shares_updated_at();

-- Admins/owner-level accounts can manage all targeted shares.
drop policy if exists "participant staff shares admin read" on public.participant_staff_shares;
create policy "participant staff shares admin read"
on public.participant_staff_shares for select
to authenticated
using (public.user_is_admin());

drop policy if exists "participant staff shares admin write" on public.participant_staff_shares;
create policy "participant staff shares admin write"
on public.participant_staff_shares for all
to authenticated
using (public.user_is_admin())
with check (public.user_is_admin());

-- Staff can read only information explicitly shared to them.
drop policy if exists "participant staff shares target read" on public.participant_staff_shares;
create policy "participant staff shares target read"
on public.participant_staff_shares for select
to authenticated
using (target_user_id = auth.uid());

grant select on public.participant_staff_shares to authenticated;
grant insert, update, delete on public.participant_staff_shares to authenticated;
