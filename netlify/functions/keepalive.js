const { createClient } = require('@supabase/supabase-js')

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

function getTokenFromEvent(event) {
  const queryToken = String(event.queryStringParameters?.token || '').trim()
  if (queryToken) return queryToken

  const headerToken = String(
    event.headers?.['x-keepalive-token']
      || event.headers?.['X-Keepalive-Token']
      || event.headers?.['x-KEEPALIVE-TOKEN']
      || ''
  ).trim()

  return headerToken
}

function getRequiredEnv() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const keepaliveToken = process.env.KEEPALIVE_TOKEN

  if (!supabaseUrl || !serviceRoleKey || !keepaliveToken) {
    throw new Error('Missing required env vars: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, KEEPALIVE_TOKEN')
  }

  return { supabaseUrl, serviceRoleKey, keepaliveToken }
}

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method not allowed' })
    }

    const { supabaseUrl, serviceRoleKey, keepaliveToken } = getRequiredEnv()
    const suppliedToken = getTokenFromEvent(event)

    if (!suppliedToken || suppliedToken !== keepaliveToken) {
      return json(401, { error: 'Unauthorized' })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // A tiny query is enough to count as project activity and prevent free-tier pause.
    const { error } = await admin.from('participants').select('id').limit(1)

    if (error) {
      return json(500, { error: error.message })
    }

    return json(200, {
      ok: true,
      pingedAt: new Date().toISOString(),
      source: 'keepalive',
    })
  } catch (error) {
    return json(500, { error: error.message || 'Keepalive failed' })
  }
}
