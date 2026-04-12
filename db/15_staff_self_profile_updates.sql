-- Step 15: Allow users to update their own staff profile
-- Run after db/08_rls_role_hardening.sql (or anytime after staff RLS policies exist).

alter table public.staff enable row level security;

drop policy if exists "staff admin write" on public.staff;
create policy "staff admin write"
on public.staff for all
to authenticated
using (public.user_is_admin())
with check (public.user_is_admin());

-- Users can create/update only their own staff row, matched by auth email.
drop policy if exists "staff self insert" on public.staff;
create policy "staff self insert"
on public.staff for insert
to authenticated
with check (
  lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "staff self update" on public.staff;
create policy "staff self update"
on public.staff for update
to authenticated
using (
  lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
