-- Step 41: Allow participant-access staff to view recently deleted participants for recovery.
-- Run in Supabase SQL Editor.

drop policy if exists "participants recently deleted read" on public.participants;

create policy "participants recently deleted read"
on public.participants for select
to authenticated
using (
  deleted_at is not null
  and deleted_at >= (now() - interval '30 days')
  and (
    public.user_is_admin()
    or public.user_has_any_tab(array['participants','parents','medical'])
  )
);