-- Step 29: Ensure timetable tables are published to Supabase Realtime.
-- Run in Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'daily_timetable_entries'
  ) then
    alter publication supabase_realtime add table public.daily_timetable_entries;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'timetable_spaces'
  ) then
    alter publication supabase_realtime add table public.timetable_spaces;
  end if;
end
$$;
