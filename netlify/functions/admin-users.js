import { createClient } from '@supabase/supabase-js'

const TAB_IDS = [
  'dashboard',
  'signin',
  'shared-info',
  'attendance',
  'participants',
  'parents',
  'dressing-rooms',
  'medical',
  'behaviour',
  'timetable',
  'incidents',
  'staff',
  'documents',
]

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

function sanitizeAllowedTabs(tabIds) {
  const incoming = Array.isArray(tabIds) ? tabIds : []
  const valid = incoming.filter(tab => TAB_IDS.includes(tab))
  if (!valid.includes('dashboard')) valid.unshift('dashboard')
  if (!valid.includes('signin')) valid.unshift('signin')
  if (!valid.includes('shared-info')) valid.unshift('shared-info')
  return [...new Set(valid)]
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

async function canManageUsers(admin, currentUser) {
  const ownerEmail = (process.env.VITE_OWNER_EMAIL || '').toLowerCase()
  const userEmail = (currentUser.email || '').toLowerCase()

  if (ownerEmail && ownerEmail === userEmail) return true

  const { data, error } = await admin
    .from('user_tab_permissions')
    .select('is_admin')
    .eq('user_id', currentUser.id)
    .maybeSingle()

  if (error) {
    return false
  }

  return !!data?.is_admin
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
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
      return json(405, { error: 'Method not allowed' })
    }

    const token = getBearerToken(event)
    if (!token) {
      return json(401, { error: 'Missing bearer token' })
    }

    const admin = await getAdminClient()
    const currentUser = await resolveCurrentUser(admin, token)
    const isAdmin = await canManageUsers(admin, currentUser)

    if (!isAdmin) {
      return json(403, { error: 'Admin access required' })
    }

    if (event.httpMethod === 'GET') {
      const [authUsers, permissionsRows, resetRequestsRows] = await Promise.all([
        listUsers(admin),
        admin.from('user_tab_permissions').select('user_id, is_admin, allowed_tabs, can_view_timetable_overview'),
        admin
          .from('password_reset_requests')
          .select('id, requester_user_id, requester_email, requester_identifier, reason, status, requested_at')
          .eq('status', 'open')
          .order('requested_at', { ascending: true }),
      ])

      if (permissionsRows.error) throw permissionsRows.error
      if (resetRequestsRows.error && !String(resetRequestsRows.error?.message || '').toLowerCase().includes('does not exist')) {
        throw resetRequestsRows.error
      }

      const permissionMap = new Map(
        (permissionsRows.data || []).map(row => [row.user_id, row])
      )

      const users = authUsers
        .map(user => {
          const row = permissionMap.get(user.id)
          const archivedByMetadata = !!user.user_metadata?.account_archived
          const archivedByBan = !!user.banned_until && new Date(user.banned_until).getTime() > Date.now()
          return {
            id: user.id,
            email: user.email || '',
            createdAt: user.created_at,
            lastSignInAt: user.last_sign_in_at,
            isArchived: archivedByMetadata || archivedByBan,
            isAdmin: !!row?.is_admin,
            canViewTimetableOverview: !!row?.can_view_timetable_overview,
            allowedTabs: sanitizeAllowedTabs(row?.allowed_tabs),
          }
        })
        .sort((a, b) => a.email.localeCompare(b.email))

      return json(200, {
        currentUser: {
          id: currentUser.id,
          email: currentUser.email || '',
          isAdmin: true,
        },
        users,
        resetRequests: resetRequestsRows.error ? [] : (resetRequestsRows.data || []),
      })
    }

    const parsed = parseJsonBody(event.body)
    if (!parsed.ok) {
      return json(400, { error: 'Request body must be valid JSON' })
    }

    const body = parsed.data
    const action = body.action

    if (action === 'create_user') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const isAdminInput = !!body.isAdmin
      const canViewTimetableOverviewInput = !!body.canViewTimetableOverview
      const allowedTabs = sanitizeAllowedTabs(body.allowedTabs)

      if (!email || !email.includes('@')) return json(400, { error: 'Valid email is required' })
      if (password.length < 8) return json(400, { error: 'Password must be at least 8 characters' })

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError) {
        return json(400, { error: createError.message })
      }

      const createdUser = created?.user
      if (!createdUser) {
        return json(500, { error: 'User creation failed without a user record' })
      }

      const { error: upsertError } = await admin.from('user_tab_permissions').upsert(
        {
          user_id: createdUser.id,
          is_admin: isAdminInput,
          can_view_timetable_overview: canViewTimetableOverviewInput,
          allowed_tabs: allowedTabs,
        },
        { onConflict: 'user_id' }
      )

      if (upsertError) {
        return json(500, { error: upsertError.message })
      }

      return json(200, {
        ok: true,
        user: {
          id: createdUser.id,
          email: createdUser.email || '',
          isAdmin: isAdminInput,
          canViewTimetableOverview: canViewTimetableOverviewInput,
          allowedTabs,
        },
      })
    }

    if (action === 'update_permissions') {
      const userId = String(body.userId || '')
      const isAdminInput = !!body.isAdmin
      const canViewTimetableOverviewInput = !!body.canViewTimetableOverview
      const allowedTabs = sanitizeAllowedTabs(body.allowedTabs)

      if (!userId) return json(400, { error: 'userId is required' })

      const { error } = await admin.from('user_tab_permissions').upsert(
        {
          user_id: userId,
          is_admin: isAdminInput,
          can_view_timetable_overview: canViewTimetableOverviewInput,
          allowed_tabs: allowedTabs,
        },
        { onConflict: 'user_id' }
      )

      if (error) {
        return json(500, { error: error.message })
      }

      return json(200, { ok: true })
    }

    if (action === 'update_user') {
      const userId = String(body.userId || '')
      const email = String(body.email || '').trim().toLowerCase()

      if (!userId) return json(400, { error: 'userId is required' })
      if (!email || !email.includes('@')) return json(400, { error: 'Valid email is required' })

      const ownerEmail = (process.env.VITE_OWNER_EMAIL || '').toLowerCase()
      const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(userId)
      if (targetError) return json(400, { error: targetError.message })

      const targetUser = targetData?.user
      if (!targetUser) return json(404, { error: 'User not found' })

      const targetEmail = (targetUser.email || '').toLowerCase()
      if (ownerEmail && targetEmail === ownerEmail && email !== ownerEmail) {
        return json(400, { error: 'Owner account email cannot be changed here' })
      }

      const { error } = await admin.auth.admin.updateUserById(userId, { email })
      if (error) {
        return json(500, { error: error.message })
      }

      return json(200, { ok: true })
    }

    if (action === 'reset_password') {
      const userId = String(body.userId || '')
      const newPassword = String(body.newPassword || '')
      const requestId = String(body.requestId || '')

      if (!userId) return json(400, { error: 'userId is required' })
      if (newPassword.length < 8) return json(400, { error: 'New password must be at least 8 characters' })

      const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(userId)
      if (targetError) return json(400, { error: targetError.message })

      const targetUser = targetData?.user
      if (!targetUser) return json(404, { error: 'User not found' })

      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: newPassword,
        user_metadata: {
          ...(targetUser.user_metadata || {}),
          must_change_password: true,
        },
      })

      if (error) {
        return json(500, { error: error.message })
      }

      if (requestId) {
        await admin
          .from('password_reset_requests')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by_user_id: currentUser.id,
            resolution_note: 'Reset completed by admin in user access management.',
          })
          .eq('id', requestId)
      }

      return json(200, { ok: true })
    }

    if (action === 'delete_user') {
      const userId = String(body.userId || '')
      if (!userId) return json(400, { error: 'userId is required' })

      if (userId === currentUser.id) {
        return json(400, { error: 'You cannot delete your own account' })
      }

      const ownerEmail = (process.env.VITE_OWNER_EMAIL || '').toLowerCase()
      if (ownerEmail) {
        const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(userId)
        if (targetError) return json(400, { error: targetError.message })

        const targetEmail = (targetData?.user?.email || '').toLowerCase()
        if (targetEmail && targetEmail === ownerEmail) {
          return json(400, { error: 'You cannot delete the owner account' })
        }
      }

      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) {
        return json(500, { error: error.message })
      }

      return json(200, { ok: true })
    }

    if (action === 'archive_user' || action === 'restore_user') {
      const userId = String(body.userId || '')
      if (!userId) return json(400, { error: 'userId is required' })

      if (userId === currentUser.id) {
        return json(400, { error: 'You cannot archive or restore your own account while signed in' })
      }

      const ownerEmail = (process.env.VITE_OWNER_EMAIL || '').toLowerCase()
      const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(userId)
      if (targetError) return json(400, { error: targetError.message })

      const targetUser = targetData?.user
      if (!targetUser) return json(404, { error: 'User not found' })

      const targetEmail = (targetUser.email || '').toLowerCase()
      if (ownerEmail && targetEmail === ownerEmail) {
        return json(400, { error: 'You cannot archive or restore the owner account' })
      }

      const shouldArchive = action === 'archive_user'
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: shouldArchive ? '876000h' : 'none',
        user_metadata: {
          ...(targetUser.user_metadata || {}),
          account_archived: shouldArchive,
        },
      })

      if (error) {
        return json(500, { error: error.message })
      }

      return json(200, { ok: true })
    }

    return json(400, { error: 'Unknown action' })
  } catch (error) {
    return json(500, { error: error.message || 'Unexpected server error' })
  }
}
