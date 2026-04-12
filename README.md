# Camp Database — Staff Portal

A secure, browser-based camp management system. Built with React + Vite.  
Deployed via Netlify. Data and auth are handled with Supabase.

---

## Features

- 🔐 Password-protected staff login
- 👥 Participant register (name, pronouns, age, role, dressing room)
- 📞 Contact details (parent/guardian, approved adults for collection)
- 🏥 Medical & dietary flags (allergy / medical / dietary) with colour coding
- ⭐ SEND / support needs notes
- ✅ Sign in / sign out with automatic timestamps
- ⚠️ Incident & accident log with PDF attachment upload
- 📊 Dashboard with live attendance overview

---

## Changing the Password

Camp login now uses Supabase Auth (email + password accounts).

The `VITE_STAFF_PASSWORD` variable still controls access to the separate Staff section lock screen.

For local development, copy `.env.example` to `.env` and set your values.

For Netlify, add the same variables in Site settings → Environment variables.

---

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Then open http://localhost:5173

---

## Integrating Interactive HTML Forms Into Incident Log

Yes, this is now supported.

The incident entry screen can load interactive form templates from:

- `/public/forms/incident-accident-reporting-form.html`
- `/public/forms/mid-camp-assessment-form.html`
- `/public/forms/send-assessment-form.html`

When a form is complete, your HTML form should post a PDF payload back to the app using `window.parent.postMessage`:

```html
<script>
	function sendPdfToCampDb(base64Pdf, fileName) {
		window.parent.postMessage(
			{
				type: 'campdb-form-pdf',
				payload: {
					base64Pdf, // raw base64 OR data URL like data:application/pdf;base64,...
					fileName: fileName || 'completed-form.pdf',
					mimeType: 'application/pdf'
				}
			},
			window.location.origin
		)
	}
</script>
```

After this message is sent, the app uploads that PDF to the `incidents` storage bucket and links it to the incident automatically.

### Query Params Passed To Each Form

Each embedded form receives these URL parameters:

- `participantId`
- `staffMember`

You can read these inside your HTML file to prefill fields.

---

## Deploy to Netlify via GitHub

1. Push this folder to a new GitHub repository
2. Go to [netlify.com](https://netlify.com) → Add new site → Import from Git
3. Select your repo
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Click **Deploy**

Netlify will automatically redeploy every time you push to GitHub.

---

## Supabase Configuration

Set these environment variables for both local development and Netlify:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STAFF_PASSWORD`
- `VITE_OWNER_EMAIL`

For secure server-side admin actions (create auth users, reset passwords, manage permissions), also set:

- `SUPABASE_SERVICE_ROLE_KEY` (Netlify environment variable; never expose in frontend code)
- `KEEPALIVE_TOKEN` (Netlify environment variable used by the automated keepalive endpoint)

## Prevent Supabase Free-Tier Auto Pause

Supabase free projects can pause after 7 days of inactivity. This repo now includes an automated keepalive flow:

- Netlify function: `/.netlify/functions/keepalive`
- GitHub Actions workflow: `.github/workflows/supabase-keepalive.yml` (runs daily)

### One-Time Setup

1. In Netlify environment variables, add:
	- `KEEPALIVE_TOKEN` (use a long random string)
	- `SUPABASE_SERVICE_ROLE_KEY` (already required by existing admin functions)
	- `VITE_SUPABASE_URL` (or `SUPABASE_URL`)
2. In GitHub repository settings, add secret:
	- `KEEPALIVE_URL`
3. Set `KEEPALIVE_URL` to:

```text
https://impactkidz.netlify.app/.netlify/functions/keepalive?token=YOUR_KEEPALIVE_TOKEN
```

4. In GitHub Actions, run the `Supabase Keepalive` workflow once manually (`workflow_dispatch`) to confirm setup.

If the workflow returns HTTP 200, your Supabase project will stay active.

## Security Baseline (Required)

Before using live data, enable Row Level Security (RLS) and avoid hardcoded credentials.

1. Confirm app config is environment-based:
	- `VITE_SUPABASE_URL`
	- `VITE_SUPABASE_ANON_KEY`
	- `VITE_STAFF_PASSWORD`
2. In Supabase SQL Editor, enable RLS on core tables:

```sql
alter table public.participants enable row level security;
alter table public.attendance enable row level security;
alter table public.incidents enable row level security;
alter table public.staff enable row level security;
```

3. Add temporary authenticated-only policies until role-specific policies are added:

```sql
create policy "participants authenticated read"
on public.participants for select
to authenticated
using (true);

create policy "participants authenticated write"
on public.participants for all
to authenticated
using (true)
with check (true);
```

Repeat equivalent policies for `attendance`, `incidents`, and `staff` as a temporary baseline.
Then replace with role-based policies in the next hardening step.

You can also run the prepared SQL file:

- `db/01_security_rls_baseline.sql`

## Supabase Auth Setup (Required)

1. In Supabase Dashboard → Authentication → Providers, keep Email enabled.
2. Create initial staff users in Authentication → Users.
3. Use those credentials to sign in through the app login screen.

## Audit Trail Setup (Required)

Run:

- `db/02_audit_log.sql`

This creates a central `audit_log` table and triggers to capture INSERT/UPDATE/DELETE activity on core records.

## Soft Delete Setup (Recommended)

Run:

- `db/03_soft_delete.sql`

This adds `deleted_at` columns for `participants`, `incidents`, and `staff`, and updates read policies so soft-deleted records are excluded from normal app queries.

## Backup and Export

Open the Documents page to export:

- Full JSON backup snapshot (participants, attendance, incidents, staff, documents)
- CSV exports per table

Use this regularly as an operational backup routine.

## Critical Flow Tests

Run tests with:

```bash
npm run test:run
```

Current critical-flow coverage includes:

- Follow-up due/overdue status logic
- Follow-up sorting and pending filtering
- CSV export escaping and formatting

Test file:

- `tests/workflow.test.js`

## Per-User Tab Permissions

To control which tabs each user can see:

1. Run SQL migration:
	- `db/04_user_tab_permissions.sql`
2. Set owner email env variable:
	- `VITE_OWNER_EMAIL` (this user always has full tab access)

Example SQL to grant full admin access:

```sql
insert into public.user_tab_permissions (user_id, is_admin, allowed_tabs)
select id, true, array['dashboard','signin','attendance','participants','parents','dressing-rooms','medical','incidents','staff','documents']::text[]
from auth.users
where email = 'owner@camp.org'
on conflict (user_id)
do update set is_admin = excluded.is_admin, allowed_tabs = excluded.allowed_tabs;
```

Example SQL to grant limited tab access for a staff member:

```sql
insert into public.user_tab_permissions (user_id, is_admin, allowed_tabs)
select id, false, array['dashboard','signin','attendance','incidents']::text[]
from auth.users
where email = 'staff1@camp.org'
on conflict (user_id)
do update set is_admin = excluded.is_admin, allowed_tabs = excluded.allowed_tabs;
```

If a user has no row in `user_tab_permissions`, they only see basic tabs (`dashboard`, `signin`).

## Production RLS Hardening (Recommended)

The baseline RLS migration is intentionally permissive for fast setup. For production, run:

- `db/08_rls_role_hardening.sql`

This migration introduces role/tab-aware write policies:

- `attendance` and incident logging remain available to authenticated staff
- `staff` writes are admin-only
- `documents` access is restricted to users with the Documents tab (or admins)
- participant profile edits require relevant tab access (`participants`, `parents`, or `medical`) or admin

Important operational note:

- ensure users who should edit protected sections have rows in `user_tab_permissions`
- if you rely on owner-only app logic via `VITE_OWNER_EMAIL`, also create a `user_tab_permissions` row for that account so database RLS and UI access remain aligned

## Camp Operations Feature Pack (Requested)

To add the requested camp-specific features (1, 2, 6, 7, 8, 10, 11), run:

- `db/09_camp_operations_features.sql`

This migration adds:

- Medication plans/forms/administration logs (no automatic parent notification)
- Consent fields: photos, first aid, OTC meds (+ allowed OTC items list)
- Staff training checkboxes + safeguarding/first-aid expiry dates
- Behaviour log table
- Editable daily timetable table (owner/admin can edit; staff see assigned entries)
- Dietary/allergy participant fields
- Attendance exception reason + notes fields

New tables:

- `medication_plans`
- `medication_forms`
- `medication_administration`
- `behaviour_logs`
- `daily_timetable_entries`

Updated existing tables:

- `participants` (consent + dietary/allergy fields)
- `staff` (training + expiry fields)
- `attendance` (exception reason + notes)

## Timetable Access Controls (Required for per-user timetable view)

Run:

- `db/10_timetable_access_controls.sql`

This migration adds `daily_timetable_entries.assigned_email` and updates timetable RLS so that:

- owner/admin users can view and edit all timetable entries
- staff users can only view entries assigned to their own login email

## Scheduler Enhancements (Recommended)

Run:

- `db/11_scheduler_overview_and_spaces.sql`
- `db/12_scheduler_space_ordering_and_flexible_slots.sql`
- `db/13_mar_parent_notification_and_meal_matrix.sql`
- `db/15_staff_self_profile_updates.sql`

This adds scheduler upgrades:

- multi-staff assignment for each activity block
- space management table (add/remove schedule spaces)
- optional overview sharing permission (`can_view_timetable_overview`) for non-admin users
- updated timetable read policy for assigned staff + shared-overview users
- database-driven space ordering (`timetable_spaces.sort_order`) with defaults:
	Dance Space, Drama Space, Art Space, bardepot, Studio Theatre
- support for flexible 09:45 to 16:30 timeline usage in the scheduler UI

The Step 13 migration adds:

- MAR audit fields for dose + manual parent notification logging
- per-child allergen matrix (`allergen_matrix`) and meal-safe tags (`meal_safe_tags`)

The Step 15 migration adds:

- self-service staff profile write access for authenticated users (their own row only, matched by login email)
- keeps admin full-write access to all staff rows

## In-App User Management (Admin)

Admins can now manage auth users directly in the Staff tab:

- Create a login account (email + temporary password)
- Assign tab permissions or full admin access
- Reset passwords for any user

This is implemented through a Netlify Function endpoint:

- `netlify/functions/admin-users.js`

The endpoint verifies the caller's Supabase session token and only allows owner/admin users.

---
