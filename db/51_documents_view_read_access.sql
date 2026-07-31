-- Step 51: Allow view-only Documents users to read uploaded document metadata.
--
-- This keeps write access restricted to users with the 'documents' tab,
-- while allowing any authenticated user to list documents.

alter table if exists public.documents enable row level security;

drop policy if exists "documents role-based read" on public.documents;

create policy "documents role-based read"
on public.documents for select
to authenticated
using (
  auth.uid() is not null
);
