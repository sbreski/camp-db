-- Step 43: Add primary medical condition field for participant records.
-- Used by Sign In/Out medical badge hover text.

alter table public.participants
  add column if not exists medical_condition text;
