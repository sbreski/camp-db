-- Step 17: Add password reset request workflow and remove staff self-edit permissions.

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid null,
  requester_email text not null,
  requester_identifier text null,
  reason text null,
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by_user_id uuid null,
  resolution_note text null
);

create index if not exists password_reset_requests_status_idx
  on public.password_reset_requests (status, requested_at);

create index if not exists password_reset_requests_email_idx
  on public.password_reset_requests (requester_email);

alter table public.password_reset_requests enable row level security;

-- Admins/owners can view and manage requests in-app.
drop policy if exists "password reset requests admin read" on public.password_reset_requests;
create policy "password reset requests admin read"
on public.password_reset_requests for select
to authenticated
using (public.user_is_admin());

drop policy if exists "password reset requests admin write" on public.password_reset_requests;
create policy "password reset requests admin write"
on public.password_reset_requests for all
to authenticated
using (public.user_is_admin())
with check (public.user_is_admin());

-- Lock down staff self-service profile changes (admin/owner only).
drop policy if exists "staff self insert" on public.staff;
drop policy if exists "staff self update" on public.staff;
