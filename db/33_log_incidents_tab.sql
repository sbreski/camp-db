-- Migration 33: Add 'log-incidents' tab for restricted incident logging
-- Users with 'log-incidents' can submit incidents but only see their own in the UI.
-- At the DB level, write access is extended to include the new tab.
-- Read filtering to own-rows is enforced on the frontend (see Incidents.jsx logOnly prop).

-- Update write policy to allow 'log-incidents' tab users to insert/update/delete
drop policy if exists "incidents role-based write" on public.incidents;

create policy "incidents role-based write"
on public.incidents for all
to authenticated
using (
  auth.uid() is not null
  and (
    public.user_is_admin()
    or public.user_has_any_tab(array['incidents','signin','log-incidents'])
  )
)
with check (
  auth.uid() is not null
  and (
    public.user_is_admin()
    or public.user_has_any_tab(array['incidents','signin','log-incidents'])
  )
);
