-- Step 45: Remediate Supabase security linter warnings.

-- 1) Ensure trigger/helper functions use a fixed search_path.
do $$
begin
  if to_regprocedure('public.set_star_of_day_awards_updated_at()') is not null then
    execute 'alter function public.set_star_of_day_awards_updated_at() set search_path = public';
  end if;

  if to_regprocedure('public.set_camp_periods_updated_at()') is not null then
    execute 'alter function public.set_camp_periods_updated_at() set search_path = public';
  end if;

  if to_regprocedure('public.set_camp_period_settings_updated_at()') is not null then
    execute 'alter function public.set_camp_period_settings_updated_at() set search_path = public';
  end if;

  if to_regprocedure('public.set_incidents_updated_at()') is not null then
    execute 'alter function public.set_incidents_updated_at() set search_path = public';
  end if;

  if to_regprocedure('public.set_participant_staff_shares_updated_at()') is not null then
    execute 'alter function public.set_participant_staff_shares_updated_at() set search_path = public';
  end if;

  if to_regprocedure('public.set_updated_at()') is not null then
    execute 'alter function public.set_updated_at() set search_path = public';
  end if;

  if to_regprocedure('public.set_dashboard_notices_updated_at()') is not null then
    execute 'alter function public.set_dashboard_notices_updated_at() set search_path = public';
  end if;
end
$$;

-- 2) Prevent direct RPC access to SECURITY DEFINER trigger function.
revoke execute on function public.log_table_change() from public;
revoke execute on function public.log_table_change() from anon;
revoke execute on function public.log_table_change() from authenticated;

-- 3) Keep helper functions callable by signed-in users, but not as SECURITY DEFINER.
alter function public.user_is_admin() security invoker;
alter function public.user_has_any_tab(text[]) security invoker;
alter function public.user_can_view_timetable_overview() security invoker;

revoke execute on function public.user_is_admin() from public;
revoke execute on function public.user_has_any_tab(text[]) from public;
revoke execute on function public.user_can_view_timetable_overview() from public;
revoke execute on function public.user_can_view_timetable_overview() from anon;

grant execute on function public.user_is_admin() to authenticated;
grant execute on function public.user_has_any_tab(text[]) to authenticated;
grant execute on function public.user_can_view_timetable_overview() to authenticated;

-- 4) Public buckets do not need broad SELECT policies on storage.objects for URL access.
drop policy if exists "Allow authenticated download from documents bucket" on storage.objects;
drop policy if exists "documents bucket authenticated read" on storage.objects;
