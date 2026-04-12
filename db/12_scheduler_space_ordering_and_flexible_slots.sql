-- Step 14: Space ordering + flexible scheduler slots
-- Run after Step 13.

alter table public.timetable_spaces
  add column if not exists sort_order integer;

-- Seed requested default ordering.
update public.timetable_spaces
set sort_order = case lower(name)
  when 'dance space' then 10
  when 'drama space' then 20
  when 'art space' then 30
  when 'bardepot' then 40
  when 'studio theatre' then 50
  else sort_order
end
where sort_order is null
  or lower(name) in ('dance space', 'drama space', 'art space', 'bardepot', 'studio theatre');

-- Any custom spaces get a stable order after defaults.
with custom_spaces as (
  select id, row_number() over (order by lower(name), id) as rn
  from public.timetable_spaces
  where sort_order is null
)
update public.timetable_spaces s
set sort_order = 100 + custom_spaces.rn
from custom_spaces
where s.id = custom_spaces.id;

alter table public.timetable_spaces
  alter column sort_order set default 1000;

create index if not exists timetable_spaces_sort_order_idx
  on public.timetable_spaces (sort_order, name);

-- Optional: keep labels tidy when inserted from admin UI.
update public.timetable_spaces
set name = btrim(name)
where name <> btrim(name);
