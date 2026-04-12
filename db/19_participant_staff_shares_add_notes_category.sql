-- Step 19: Allow sharing participant additional notes to selected staff.

alter table public.participant_staff_shares
  drop constraint if exists participant_staff_shares_category_check;

alter table public.participant_staff_shares
  add constraint participant_staff_shares_category_check
  check (category in ('send', 'allergy', 'medical', 'dietary', 'notes'));
