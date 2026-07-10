-- Step 46: Add a dedicated EpiPen flag for participant allergy records.

alter table public.participants
  add column if not exists has_epipen boolean not null default false;

update public.participants
set has_epipen = true
where coalesce(has_epipen, false) = false
  and coalesce(allergy_details, '') ~* 'epi\s*-?\s*pen|epinephrine\s+auto\s*-?\s*injector';