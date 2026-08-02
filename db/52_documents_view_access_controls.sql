-- Step 52: Per-document visibility controls for the view-only Documents tab.
--
-- Adds a flag admins can toggle to hide specific documents from general viewers.

alter table public.documents
  add column if not exists is_view_blocked boolean not null default false,
  add column if not exists view_blocked_at timestamptz,
  add column if not exists view_blocked_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists documents_is_view_blocked_idx
  on public.documents (is_view_blocked);

-- Recreate read policy so blocked docs are hidden from general authenticated users,
-- while admins and users with the Document Upload tab can still view/manage them.
drop policy if exists "documents role-based read" on public.documents;

create policy "documents role-based read"
on public.documents for select
to authenticated
using (
  auth.uid() is not null
  and (
    coalesce(is_view_blocked, false) = false
    or public.user_is_admin()
    or public.user_has_any_tab(array['documents'])
  )
);
