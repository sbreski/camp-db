-- Migration 34: Track the uploading user for documents.
-- This makes per-user views such as Log Incidents -> My Reports reliable.

alter table public.documents
  add column if not exists uploaded_by_user_id uuid null references auth.users(id) on delete set null;

create index if not exists documents_uploaded_by_user_id_idx
  on public.documents (uploaded_by_user_id);
