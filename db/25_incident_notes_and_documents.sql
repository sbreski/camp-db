-- Step 25: Support timestamped incident notes and additional incident documents.
-- Run in Supabase SQL Editor.

alter table public.incidents
  add column if not exists incident_notes jsonb not null default '[]'::jsonb,
  add column if not exists incident_documents jsonb not null default '[]'::jsonb;
