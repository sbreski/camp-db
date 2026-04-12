-- Step 13: MAR audit safety fields + dietary/allergy meal matrix
-- Run after db/12_scheduler_space_ordering_and_flexible_slots.sql

-- -----------------------------------------------------------------------------
-- MAR safety tracking fields
-- -----------------------------------------------------------------------------
alter table public.medication_administration
  add column if not exists dose_given text,
  add column if not exists medication_name text,
  add column if not exists parent_notified boolean not null default false,
  add column if not exists parent_notified_at timestamptz,
  add column if not exists parent_notification_method text,
  add column if not exists parent_notification_notes text;

create index if not exists medication_administration_parent_notified_idx
  on public.medication_administration (parent_notified, administered_at desc);

-- -----------------------------------------------------------------------------
-- Per-child dietary/allergen matrix fields
-- -----------------------------------------------------------------------------
alter table public.participants
  add column if not exists allergen_matrix jsonb not null default '{}'::jsonb,
  add column if not exists meal_safe_tags text[] not null default '{}'::text[];

create index if not exists participants_allergen_matrix_gin_idx
  on public.participants using gin (allergen_matrix);

create index if not exists participants_meal_safe_tags_gin_idx
  on public.participants using gin (meal_safe_tags);
