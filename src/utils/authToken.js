import { supabase } from '../supabase'

const TOKEN_REFRESH_GRACE_MS = 30 * 1000
const SESSION_RETRY_DELAY_MS = 120

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function readSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data?.session || null
}

export async function getFreshSession(graceMs = TOKEN_REFRESH_GRACE_MS) {
  // Supabase can briefly report a null session while auth state hydrates after reload.
  let session = await readSession()
  if (!session) {
    await sleep(SESSION_RETRY_DELAY_MS)
    session = await readSession()
  }

  if (!session) {
    throw new Error('No active auth session. Please sign in again.')
  }

  const expiresAtMs = Number(session?.expires_at || 0) * 1000
  const shouldRefresh = Number.isFinite(expiresAtMs) && expiresAtMs <= (Date.now() + graceMs)

  if (shouldRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      const message = String(refreshError.message || '').toLowerCase()
      // If refresh raced with a pending auth-state update, re-read once before failing.
      if (message.includes('auth session missing')) {
        session = await readSession()
      } else {
        throw refreshError
      }
    } else {
      session = refreshed?.session || session
    }
  }

  if (!session?.access_token) {
    throw new Error('No active auth session. Please sign in again.')
  }

  return session
}

export async function getFreshAccessToken(graceMs = TOKEN_REFRESH_GRACE_MS) {
  const session = await getFreshSession(graceMs)
  return session.access_token
}
