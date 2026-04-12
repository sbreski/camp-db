-- Step 14: Hard reset timetable data
-- Use this when you want to clear all timetable entries and spaces and re-add them manually.
-- WARNING: This permanently deletes timetable data.

begin;

delete from public.daily_timetable_entries;
delete from public.timetable_spaces;

commit;
