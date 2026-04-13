-- Step 26: Support participant-level notes history and additional documents.
-- Run in Supabase SQL Editor.

alter table public.participants
  add column if not exists participant_notes_history jsonb not null default '[]'::jsonb,
  add column if not exists participant_documents jsonb not null default '[]'::jsonb;
