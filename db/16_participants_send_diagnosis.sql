-- Step 16: Add SEND diagnosis field for participant records
-- This stores formal diagnosis details separately from general SEND support notes.

alter table public.participants
  add column if not exists send_diagnosis text;
