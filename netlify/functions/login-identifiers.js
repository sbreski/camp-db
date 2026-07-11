import { createClient } from '@supabase/supabase-js'

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  }
}

function parseJsonBody(body) {
  if (!body) return { ok: true, data: {} }
  try {
    return { ok: true, data: JSON.parse(body) }
  } catch (_error) {
    return { ok: false, data: null }
  }
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

function parseUsernameAliases(rawAliases, primaryUsername = '') {
  const normalizedPrimary = normalizeUsername(primaryUsername)

  const source = Array.isArray(rawAliases)
    ? rawAliases
    : String(rawAliases || '')
        .split(/[\n,]/)

  const aliases = source
    .map(value => normalizeUsername(value))
    .filter(Boolean)
    .filter(value => value !== normalizedPrimary)

  return [...new Set(aliases)]
}

async function getAdminClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing server environment variables: VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function listUsers(admin) {
  const users = []
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const batch = data?.users || []
    users.push(...batch)

    if (batch.length < perPage) break
    page += 1
  }

  return users
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method not allowed' })
    }

    const parsed = parseJsonBody(event.body)
    if (!parsed.ok) return json(400, { error: 'Request body must be valid JSON' })

    const identifier = String(parsed.data?.identifier || '').trim()
    if (!identifier) return json(200, { candidates: [] })

    const lowered = identifier.toLowerCase()
    const rawUsername = lowered.endsWith('@login.local') ? lowered.replace('@login.local', '') : identifier
    const targetUsername = normalizeUsername(rawUsername)

    const candidates = []
    const addCandidate = value => {
      const normalized = String(value || '').trim().toLowerCase()
      if (!normalized) return
      if (!candidates.includes(normalized)) candidates.push(normalized)
    }

    if (lowered.includes('@') && !lowered.endsWith('@login.local')) addCandidate(lowered)
    if (lowered.endsWith('@login.local')) addCandidate(lowered)
    if (targetUsername) addCandidate(`${targetUsername}@login.local`)

    if (!targetUsername) return json(200, { candidates })

    const admin = await getAdminClient()
    const authUsers = await listUsers(admin)

    authUsers.forEach(user => {
      const internalEmail = String(user?.email || '').trim().toLowerCase()
      if (!internalEmail) return

      const primaryUsername = normalizeUsername(user?.user_metadata?.username || '')
      const aliases = parseUsernameAliases(user?.user_metadata?.username_aliases, primaryUsername)
      if (primaryUsername === targetUsername || aliases.includes(targetUsername)) {
        addCandidate(internalEmail)
      }
    })

    return json(200, { candidates })
  } catch (_error) {
    // Keep this endpoint non-revealing and non-blocking for login UX.
    return json(200, { candidates: [] })
  }
}
