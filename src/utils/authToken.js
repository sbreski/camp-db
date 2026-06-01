import { supabase } from '../supabase'

const TOKEN_REFRESH_GRACE_MS = 30 * 1000

export async function getFreshSession(graceMs = TOKEN_REFRESH_GRACE_MS) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  let session = data?.session || null
  const expiresAtMs = Number(session?.expires_at || 0) * 1000
  const shouldRefresh = !session || (Number.isFinite(expiresAtMs) && expiresAtMs <= (Date.now() + graceMs))

  if (shouldRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) throw refreshError
    session = refreshed?.session || null
  }

  if (!session?.access_token) {
    throw new Error('No active auth session')
  }

  return session
}

export async function getFreshAccessToken(graceMs = TOKEN_REFRESH_GRACE_MS) {
  const session = await getFreshSession(graceMs)
  return session.access_token
}
