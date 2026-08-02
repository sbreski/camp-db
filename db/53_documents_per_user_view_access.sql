-- Step 53: Per-user document view access controls.
--
-- Allows admins/document managers to grant visibility of blocked documents
-- to specific login accounts.

create table if not exists public.document_view_access (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create index if not exists document_view_access_user_idx
  on public.document_view_access (user_id);

alter table public.document_view_access enable row level security;

drop policy if exists "document view access select" on public.document_view_access;
drop policy if exists "document view access insert" on public.document_view_access;
drop policy if exists "document view access delete" on public.document_view_access;

create policy "document view access select"
on public.document_view_access for select
to authenticated
using (
  user_id = auth.uid()
  or
  public.user_is_admin()
  or public.user_has_any_tab(array['documents'])
);

create policy "document view access insert"
on public.document_view_access for insert
to authenticated
with check (
  public.user_is_admin()
  or public.user_has_any_tab(array['documents'])
);

create policy "document view access delete"
on public.document_view_access for delete
to authenticated
using (
  public.user_is_admin()
  or public.user_has_any_tab(array['documents'])
);

grant select, insert, delete on public.document_view_access to authenticated;

-- Recreate documents read policy to permit explicit per-user access for blocked docs.
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
    or exists (
      select 1
      from public.document_view_access dva
      where dva.document_id = documents.id
        and dva.user_id = auth.uid()
    )
  )
);
