-- Step 40: Tighten incident write access for log-incidents users.
-- Users with the dedicated log-incidents tab may only modify incidents they created.
-- Full incidents/signin users and admins retain broader operational access.

drop policy if exists "incidents role-based write" on public.incidents;

create policy "incidents role-based write"
on public.incidents for all
to authenticated
using (
  auth.uid() is not null
  and (
    public.user_is_admin()
    or public.user_has_any_tab(array['incidents','signin'])
    or (
      public.user_has_any_tab(array['log-incidents'])
      and created_by_user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() is not null
  and (
    public.user_is_admin()
    or public.user_has_any_tab(array['incidents','signin'])
    or (
      public.user_has_any_tab(array['log-incidents'])
      and created_by_user_id = auth.uid()
    )
  )
);