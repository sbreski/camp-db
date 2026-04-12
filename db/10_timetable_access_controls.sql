-- Step 12: Timetable access controls and assignment
-- Owner/admin can manage all timetables.
-- Standard users can only view entries assigned to their own login email.

alter table public.daily_timetable_entries
  add column if not exists assigned_email text;

create index if not exists daily_timetable_entries_assigned_email_idx
  on public.daily_timetable_entries (lower(assigned_email), day_date, start_time);

-- Best-effort backfill from staff name when lead_staff exactly matches staff.name.
update public.daily_timetable_entries t
set assigned_email = lower(s.email)
from public.staff s
where t.assigned_email is null
  and s.email is not null
  and lower(coalesce(t.lead_staff, '')) = lower(coalesce(s.name, ''));

alter table public.daily_timetable_entries enable row level security;

drop policy if exists "daily timetable authenticated read" on public.daily_timetable_entries;
create policy "daily timetable role-based read"
on public.daily_timetable_entries for select
to authenticated
using (
  public.user_is_admin()
  or lower(coalesce(assigned_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "daily timetable authenticated write" on public.daily_timetable_entries;
create policy "daily timetable admin write"
on public.daily_timetable_entries for all
to authenticated
using (public.user_is_admin())
with check (public.user_is_admin());
