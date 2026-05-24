-- Step 39: Add explicit family grouping key for sibling linking and pickup code grouping.
-- Run in Supabase SQL Editor.

alter table public.participants
  add column if not exists family_group_key text;

create index if not exists participants_family_group_key_idx
  on public.participants (family_group_key);
