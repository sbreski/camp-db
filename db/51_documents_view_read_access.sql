-- Step 51: Allow view-only Documents users to read uploaded document metadata.
--
-- This keeps write access restricted to users with the 'documents' tab,
-- while allowing users with the new 'documents-view' tab to list documents.

alter table if exists public.documents enable row level security;

drop policy if exists "documents role-based read" on public.documents;

create policy "documents role-based read"
on public.documents for select
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['documents', 'documents-view'])
);
