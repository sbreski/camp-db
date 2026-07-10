-- Step 47: Add explicit safeguarding_reports RLS baseline policy.
-- Run in Supabase SQL Editor after previous migrations.
--
-- We intentionally deny direct client access to safeguarding reports.
-- Reports should be read/written via trusted server-side flows using the service role.

alter table if exists public.safeguarding_reports enable row level security;

drop policy if exists "safeguarding reports deny direct client access" on public.safeguarding_reports;
create policy "safeguarding reports deny direct client access"
on public.safeguarding_reports for all
to authenticated
using (false)
with check (false);
