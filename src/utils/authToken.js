import { supabase } from '../supabase'

const TOKEN_REFRESH_GRACE_MS = 30 * 1000
const SESSION_RETRY_DELAY_MS = 120
const MIN_TOKEN_VALIDITY_MS = 1000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function readSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data?.session || null
}

function getSessionExpiryMs(session) {
  return Number(session?.expires_at || 0) * 1000
}

function isSessionUsable(session, minValidityMs = MIN_TOKEN_VALIDITY_MS) {
  if (!session?.access_token) return false
  const expiresAtMs = getSessionExpiryMs(session)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= 0) return true
  return expiresAtMs > (Date.now() + minValidityMs)
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

  const expiresAtMs = getSessionExpiryMs(session)
  const shouldRefresh = Number.isFinite(expiresAtMs) && expiresAtMs <= (Date.now() + graceMs)

  if (shouldRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      const message = String(refreshError.message || '').toLowerCase()
      // If refresh raced with a pending auth-state update, re-read once before failing.
      if (message.includes('auth session missing')) {
        await sleep(SESSION_RETRY_DELAY_MS)
        session = await readSession()
        if (!session) {
          throw new Error('No active auth session. Please sign in again.')
        }
      } else {
        throw refreshError
      }
    } else {
      session = refreshed?.session || session
    }
  }

  if (!isSessionUsable(session)) {
    // One more read to absorb auth-state timing races before failing hard.
    await sleep(SESSION_RETRY_DELAY_MS)
    session = await readSession()
    if (!isSessionUsable(session, 0)) {
      throw new Error('No active auth session. Please sign in again.')
    }
  }

  return session
}

export async function getFreshAccessToken(graceMs = TOKEN_REFRESH_GRACE_MS) {
  const session = await getFreshSession(graceMs)
  return session.access_token
}
