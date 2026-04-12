-- Step 11: Camp operations features bundle
-- Covers requested features: 1, 2, 6, 7, 8, 10, 11.
-- Run in Supabase SQL Editor after Step 10 (08_rls_role_hardening.sql).

-- -----------------------------------------------------------------------------
-- 2 + 10: Participant consents + dietary/allergy matrix fields
-- -----------------------------------------------------------------------------
alter table public.participants
  add column if not exists photo_consent text check (photo_consent in ('yes', 'no', 'limited')),
  add column if not exists first_aid_consent boolean,
  add column if not exists otc_consent boolean,
  add column if not exists otc_allowed_items text[] not null default '{}'::text[],
  add column if not exists otc_notes text,
  add column if not exists dietary_type text,
  add column if not exists allergy_details text,
  add column if not exists meal_adjustments text;

create index if not exists participants_dietary_type_idx
  on public.participants (dietary_type);

-- -----------------------------------------------------------------------------
-- 6: Staff training checkboxes + expiry dates
-- -----------------------------------------------------------------------------
alter table public.staff
  add column if not exists first_aid_trained boolean not null default false,
  add column if not exists safeguarding_trained boolean not null default false,
  add column if not exists first_aid_expires_on date,
  add column if not exists safeguarding_expires_on date;

create index if not exists staff_first_aid_expires_on_idx
  on public.staff (first_aid_expires_on);

create index if not exists staff_safeguarding_expires_on_idx
  on public.staff (safeguarding_expires_on);

-- -----------------------------------------------------------------------------
-- 1: Medication forms and administration (no automatic parent notifications)
-- -----------------------------------------------------------------------------
create table if not exists public.medication_plans (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  medication_name text not null,
  dosage text,
  route text,
  frequency text,
  administration_windows text[] not null default '{}'::text[],
  start_date date,
  end_date date,
  requires_form boolean not null default true,
  notes text,
  is_active boolean not null default true,
  created_by_initials text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medication_plans_participant_idx
  on public.medication_plans (participant_id, is_active);

create index if not exists medication_plans_dates_idx
  on public.medication_plans (start_date, end_date);

create table if not exists public.medication_forms (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  medication_plan_id uuid references public.medication_plans(id) on delete set null,
  form_name text not null,
  storage_path text not null,
  uploaded_by_initials text,
  valid_from date,
  valid_until date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists medication_forms_participant_idx
  on public.medication_forms (participant_id, created_at desc);

create index if not exists medication_forms_valid_until_idx
  on public.medication_forms (valid_until);

create table if not exists public.medication_administration (
  id uuid primary key default gen_random_uuid(),
  medication_plan_id uuid references public.medication_plans(id) on delete set null,
  participant_id uuid not null references public.participants(id) on delete cascade,
  administered_at timestamptz not null,
  status text not null check (status in ('given', 'refused', 'missed', 'withheld')),
  staff_initials text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists medication_administration_participant_idx
  on public.medication_administration (participant_id, administered_at desc);

create index if not exists medication_administration_plan_idx
  on public.medication_administration (medication_plan_id, administered_at desc);

-- -----------------------------------------------------------------------------
-- 7: Behaviour log
-- -----------------------------------------------------------------------------
create table if not exists public.behaviour_logs (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  logged_at timestamptz not null default now(),
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  trigger_text text,
  action_taken text,
  outcome text,
  staff_initials text not null,
  tags text[] not null default '{}'::text[],
  escalated_incident_id uuid references public.incidents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists behaviour_logs_participant_idx
  on public.behaviour_logs (participant_id, logged_at desc);

create index if not exists behaviour_logs_severity_idx
  on public.behaviour_logs (severity, logged_at desc);

-- -----------------------------------------------------------------------------
-- 8: Editable daily timetable (shared for all staff)
-- -----------------------------------------------------------------------------
create table if not exists public.daily_timetable_entries (
  id uuid primary key default gen_random_uuid(),
  day_date date not null,
  start_time time not null,
  end_time time,
  activity_name text not null,
  group_name text,
  location text,
  lead_staff text,
  notes text,
  created_by_initials text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_timetable_entries_end_after_start
    check (end_time is null or end_time > start_time)
);

create index if not exists daily_timetable_entries_day_time_idx
  on public.daily_timetable_entries (day_date, start_time);

-- -----------------------------------------------------------------------------
-- 11: Attendance exception reasons
-- -----------------------------------------------------------------------------
alter table public.attendance
  add column if not exists exception_reason text check (exception_reason in ('illness', 'holiday', 'no_show', 'late_arrival', 'early_leave', 'other')),
  add column if not exists exception_notes text;

create index if not exists attendance_exception_reason_idx
  on public.attendance (exception_reason);

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger reuse
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_medication_plans_updated_at on public.medication_plans;
create trigger trg_medication_plans_updated_at
before update on public.medication_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_behaviour_logs_updated_at on public.behaviour_logs;
create trigger trg_behaviour_logs_updated_at
before update on public.behaviour_logs
for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_timetable_entries_updated_at on public.daily_timetable_entries;
create trigger trg_daily_timetable_entries_updated_at
before update on public.daily_timetable_entries
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS policies for new tables
-- -----------------------------------------------------------------------------
alter table public.medication_plans enable row level security;
alter table public.medication_forms enable row level security;
alter table public.medication_administration enable row level security;
alter table public.behaviour_logs enable row level security;
alter table public.daily_timetable_entries enable row level security;

-- Medication: readable by authenticated staff; writable by admin or medical access.
drop policy if exists "medication plans authenticated read" on public.medication_plans;
create policy "medication plans authenticated read"
on public.medication_plans for select
to authenticated
using (true);

drop policy if exists "medication plans role-based write" on public.medication_plans;
create policy "medication plans role-based write"
on public.medication_plans for all
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['medical'])
)
with check (
  public.user_is_admin()
  or public.user_has_any_tab(array['medical'])
);

drop policy if exists "medication forms authenticated read" on public.medication_forms;
create policy "medication forms authenticated read"
on public.medication_forms for select
to authenticated
using (true);

drop policy if exists "medication forms role-based write" on public.medication_forms;
create policy "medication forms role-based write"
on public.medication_forms for all
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['medical'])
)
with check (
  public.user_is_admin()
  or public.user_has_any_tab(array['medical'])
);

drop policy if exists "medication administration authenticated read" on public.medication_administration;
create policy "medication administration authenticated read"
on public.medication_administration for select
to authenticated
using (true);

drop policy if exists "medication administration role-based write" on public.medication_administration;
create policy "medication administration role-based write"
on public.medication_administration for all
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['medical', 'signin'])
)
with check (
  public.user_is_admin()
  or public.user_has_any_tab(array['medical', 'signin'])
);

-- Behaviour log: readable by authenticated staff; writable by admin or participant/reporting access.
drop policy if exists "behaviour logs authenticated read" on public.behaviour_logs;
create policy "behaviour logs authenticated read"
on public.behaviour_logs for select
to authenticated
using (true);

drop policy if exists "behaviour logs role-based write" on public.behaviour_logs;
create policy "behaviour logs role-based write"
on public.behaviour_logs for all
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['participants', 'incidents', 'signin'])
)
with check (
  public.user_is_admin()
  or public.user_has_any_tab(array['participants', 'incidents', 'signin'])
);

-- Timetable: readable + editable by all authenticated staff.
drop policy if exists "daily timetable authenticated read" on public.daily_timetable_entries;
create policy "daily timetable authenticated read"
on public.daily_timetable_entries for select
to authenticated
using (true);

drop policy if exists "daily timetable authenticated write" on public.daily_timetable_entries;
create policy "daily timetable authenticated write"
on public.daily_timetable_entries for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- Audit trigger attachment for new operational tables (if audit function exists)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.log_table_change()') is not null then
    drop trigger if exists trg_audit_medication_plans on public.medication_plans;
    create trigger trg_audit_medication_plans
    after insert or update or delete on public.medication_plans
    for each row execute function public.log_table_change();

    drop trigger if exists trg_audit_medication_forms on public.medication_forms;
    create trigger trg_audit_medication_forms
    after insert or update or delete on public.medication_forms
    for each row execute function public.log_table_change();

    drop trigger if exists trg_audit_medication_administration on public.medication_administration;
    create trigger trg_audit_medication_administration
    after insert or update or delete on public.medication_administration
    for each row execute function public.log_table_change();

    drop trigger if exists trg_audit_behaviour_logs on public.behaviour_logs;
    create trigger trg_audit_behaviour_logs
    after insert or update or delete on public.behaviour_logs
    for each row execute function public.log_table_change();

    drop trigger if exists trg_audit_daily_timetable_entries on public.daily_timetable_entries;
    create trigger trg_audit_daily_timetable_entries
    after insert or update or delete on public.daily_timetable_entries
    for each row execute function public.log_table_change();
  end if;
end $$;
