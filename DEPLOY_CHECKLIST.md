# Pre-Deploy Test Script

Use this before every deployment.

## 1. Preparation

Run from project root:

```bash
pwd
npm install
cp -n .env.example .env
```

Confirm `.env` includes:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_STAFF_PASSWORD
- VITE_OWNER_EMAIL

If testing Netlify functions locally, also ensure:

- SUPABASE_SERVICE_ROLE_KEY

Pass gate:

- Install completes with no errors.
- Env vars are present.

## 2. Automated Tests + Build

```bash
npm run test:run
npm run build
```

Pass gate:

- Tests exit successfully.
- Build exits successfully.

## 3. Frontend Local Smoke Test

Start app:

```bash
npm run dev
```

Open the shown localhost URL and verify:

- Login/logout works.
- Dashboard loads without console errors.
- Participants list loads and search works.
- Participant create + edit + save works.
- Attendance sign-in and sign-out works.
- Incident create works.
- Incident attachment upload works.
- Documents page loads and export works.

Pass gate:

- No blocking UI errors.
- No failed network requests for core flows.

## 4. Netlify Functions Local Test

In a second terminal:

```bash
npx netlify dev
```

Validate serverless endpoints used by app flows:

- Admin user actions
- Password reset requests
- Safeguarding report actions

Pass gate:

- Function calls return 2xx for valid requests.
- Error handling returns clear messages for invalid requests.

## 5. Permissions / RLS Verification (Critical)

Test with at least two accounts:

- Owner/admin account
- Non-admin staff account

Verify:

- Non-admin cannot perform admin-only actions.
- Tab visibility matches expected permissions.
- Records are only visible/editable per policy.

Pass gate:

- Zero unauthorized data access.
- Zero unexpected permission denials for allowed actions.

## 6. Migration Rehearsal (Staging First)

Before production DB changes, apply new SQL on staging Supabase in order.

If you are introducing a new migration file in `db/`, do this sequence:

1. Apply migration to staging.
2. Run full checklist steps 2 to 5 against staging data.
3. Confirm no regressions.
4. Apply to production.

Pass gate:

- Migration succeeds on staging and production.
- App remains fully functional after migration.

## 7. Production Release Steps

```bash
npm run build
```

Deploy via your normal Netlify flow (Git push or manual deploy).

Immediately run production smoke checks:

- Login
- Dashboard
- Participant create/edit
- Attendance sign-in/out
- Incident create + attachment
- Documents export
- Admin-only actions

Pass gate:

- All critical flows work in production.

## 8. Rollback Trigger Rules

Rollback or hotfix immediately if any of these occur:

- Users cannot log in.
- Attendance cannot be recorded.
- Incident creation/upload is broken.
- Permission leakage is detected.
- Widespread 5xx errors from functions.

## 9. Quick Command Pack

```bash
npm install
npm run test:run
npm run build
npm run dev
# in second terminal
npx netlify dev
```

## 10. Release Sign-Off Template

Copy this into your release notes each deploy:

- Tests: PASS/FAIL
- Build: PASS/FAIL
- Local smoke: PASS/FAIL
- Netlify functions local: PASS/FAIL
- Permissions/RLS check: PASS/FAIL
- Staging migration rehearsal: PASS/FAIL
- Production smoke after deploy: PASS/FAIL
- Decision: DEPLOY / HOLD
