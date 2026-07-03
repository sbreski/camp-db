import { supabase } from '../supabase'

const TOKEN_REFRESH_GRACE_MS = 30 * 1000
const MIN_TOKEN_VALIDITY_MS = 1000

// Safari restores session from IndexedDB/localStorage significantly slower than
// other browsers after a page load or deploy-triggered cache bust. We poll with
// a backoff rather than a single short retry so Safari has enough time to hydrate
// its auth state without affecting faster browsers (they resolve on attempt 1-2).
const SESSION_POLL_ATTEMPTS = 8
const SESSION_POLL_DELAY_MS = 300

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
  // Poll for the session so Safari's slow IndexedDB hydration doesn't cause
  // a spurious "no session" error on first load after a deploy.
  let session = null
  for (let attempt = 0; attempt < SESSION_POLL_ATTEMPTS; attempt++) {
    session = await readSession()
    if (session) break
    await sleep(SESSION_POLL_DELAY_MS)
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
        await sleep(SESSION_POLL_DELAY_MS)
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
    await sleep(SESSION_POLL_DELAY_MS)
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
