-- Step 4: Immutable audit trail
-- Run in Supabase SQL Editor.

create table if not exists public.audit_log (
  id bigserial primary key,
  table_name text not null,
  action text not null,
  row_id text,
  actor_uuid uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_table_name_idx on public.audit_log(table_name);
create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);
create index if not exists audit_log_actor_uuid_idx on public.audit_log(actor_uuid);

create or replace function public.log_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  target_row_id text;
begin
  actor := auth.uid();

  if tg_op = 'DELETE' then
    target_row_id := coalesce(old.id::text, null);
    insert into public.audit_log (table_name, action, row_id, actor_uuid, old_data, new_data)
    values (tg_table_name, tg_op, target_row_id, actor, to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    target_row_id := coalesce(new.id::text, old.id::text, null);
    insert into public.audit_log (table_name, action, row_id, actor_uuid, old_data, new_data)
    values (tg_table_name, tg_op, target_row_id, actor, to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'INSERT' then
    target_row_id := coalesce(new.id::text, null);
    insert into public.audit_log (table_name, action, row_id, actor_uuid, old_data, new_data)
    values (tg_table_name, tg_op, target_row_id, actor, null, to_jsonb(new));
    return new;
  end if;

  return null;
end;
$$;

-- Attach triggers to core tables if they exist.
do $$
begin
  if to_regclass('public.participants') is not null then
    drop trigger if exists trg_audit_participants on public.participants;
    create trigger trg_audit_participants
    after insert or update or delete on public.participants
    for each row execute function public.log_table_change();
  end if;

  if to_regclass('public.attendance') is not null then
    drop trigger if exists trg_audit_attendance on public.attendance;
    create trigger trg_audit_attendance
    after insert or update or delete on public.attendance
    for each row execute function public.log_table_change();
  end if;

  if to_regclass('public.incidents') is not null then
    drop trigger if exists trg_audit_incidents on public.incidents;
    create trigger trg_audit_incidents
    after insert or update or delete on public.incidents
    for each row execute function public.log_table_change();
  end if;

  if to_regclass('public.staff') is not null then
    drop trigger if exists trg_audit_staff on public.staff;
    create trigger trg_audit_staff
    after insert or update or delete on public.staff
    for each row execute function public.log_table_change();
  end if;

  if to_regclass('public.documents') is not null then
    drop trigger if exists trg_audit_documents on public.documents;
    create trigger trg_audit_documents
    after insert or update or delete on public.documents
    for each row execute function public.log_table_change();
  end if;
end $$;

-- Restrict read access to authenticated users.
alter table public.audit_log enable row level security;

drop policy if exists "audit log authenticated read" on public.audit_log;
create policy "audit log authenticated read"
on public.audit_log for select
to authenticated
using (true);
