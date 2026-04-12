-- Step 23: Add timetable editor permission for non-admin users
-- Allows designated staff to edit the timetable without full admin access.

alter table public.user_tab_permissions
  add column if not exists can_edit_timetable boolean default false;
