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

function getBearerToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  if (!authHeader.startsWith('Bearer ')) return ''
  return authHeader.slice('Bearer '.length).trim()
}

function parseJsonBody(body) {
  if (!body) return { ok: true, data: {} }
  try {
    return { ok: true, data: JSON.parse(body) }
  } catch (_error) {
    return { ok: false, data: null }
  }
}

async function resolveCurrentUser(admin, token) {
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) {
    throw new Error('Invalid auth token')
  }
  return data.user
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method not allowed' })
    }

    const parsed = parseJsonBody(event.body)
    if (!parsed.ok) {
      return json(400, { error: 'Request body must be valid JSON' })
    }

    const action = String(parsed.data?.action || '')
    if (action !== 'create_request') {
      return json(400, { error: 'Unknown action' })
    }

    const admin = await getAdminClient()
    const token = getBearerToken(event)

    let requesterUserId = null
    let requesterEmail = ''
    if (token) {
      const currentUser = await resolveCurrentUser(admin, token)
      requesterUserId = currentUser.id
      requesterEmail = String(currentUser.email || '').toLowerCase()
    } else {
      requesterEmail = String(parsed.data?.email || '').trim().toLowerCase()
      if (!requesterEmail || !requesterEmail.includes('@')) {
        return json(400, { error: 'Valid email is required when not signed in' })
      }
    }

    const reason = String(parsed.data?.reason || '').trim()
    const requesterIdentifier = String(parsed.data?.identifier || '').trim()

    const { data: openExisting, error: existingError } = await admin
      .from('password_reset_requests')
      .select('id')
      .eq('requester_email', requesterEmail)
      .eq('status', 'open')
      .limit(1)

    if (existingError) return json(500, { error: existingError.message })
    if (Array.isArray(openExisting) && openExisting.length > 0) {
      return json(200, { ok: true, alreadyOpen: true })
    }

    const { error } = await admin
      .from('password_reset_requests')
      .insert({
        requester_user_id: requesterUserId,
        requester_email: requesterEmail,
        requester_identifier: requesterIdentifier || null,
        reason: reason || null,
        status: 'open',
      })

    if (error) return json(500, { error: error.message })

    return json(200, { ok: true })
  } catch (error) {
    return json(500, { error: error.message || 'Unexpected server error' })
  }
}
