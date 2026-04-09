# Camp Database — Staff Portal

A secure, browser-based camp management system. Built with React + Vite.  
Deployed via Netlify. Data stored in localStorage (prototype) — ready to swap to Supabase.

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

Open `src/App.jsx` and change line:

```js
const CAMP_PASSWORD = 'camp2025'
```

Change `'camp2025'` to whatever password you want, then redeploy.

---

## Local Development

```bash
npm install
npm run dev
```

Then open http://localhost:5173

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

## Upgrading to Supabase (Live Database)

When you're ready to move beyond localStorage (so data is shared between
all staff devices in real time), the upgrade path is:

1. Create a free account at [supabase.com](https://supabase.com)
2. Create tables: `participants`, `attendance`, `incidents`
3. Replace the `useStorage` hook calls in `App.jsx` with Supabase queries
4. Add your Supabase URL and anon key as Netlify environment variables

This can be done without changing any of the UI components.

---

## Data Note (Prototype)

Data is saved to the browser's `localStorage`. This means:
- Data persists between sessions on the **same device/browser**
- Data is **not shared** between different devices or staff members yet
- Clearing browser data will erase it — export important records manually

This is intentional for the prototype. The Supabase upgrade fixes this.
