import { createClient } from '@supabase/supabase-js'

const TAB_IDS = [
  'dashboard',
  'signin',
  'shared-info',
  'attendance',
  'star-of-day',
  'participants',
  'parents',
  'dressing-rooms',
  'medical',
  'behaviour',
  'timetable',
  'log-incidents',
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

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[']/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

async function resolveCurrentUser(admin, token) {
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) {
    const authError = new Error(error?.message || 'Invalid auth token')
    authError.statusCode = 401
    throw authError
  }
  return data.user
}

async function isOwnerViaUsernameAccount(admin, currentUser, ownerEmail) {
  if (!ownerEmail) return false

  const userEmail = String(currentUser.email || '').toLowerCase()
  const username = normalizeUsername(currentUser.user_metadata?.username || '')
  if (!userEmail.endsWith('@login.local') || !username) return false

  const { data, error } = await admin
    .from('staff')
    .select('name')
    .eq('email', ownerEmail)
    .is('deleted_at', null)
    .limit(1)

  if (error || !Array.isArray(data) || data.length === 0) return false
  return normalizeUsername(data[0]?.name || '') === username
}

async function canManageUsers(admin, currentUser) {
  const ownerEmail = (process.env.VITE_OWNER_EMAIL || '').toLowerCase()
  const userEmail = (currentUser.email || '').toLowerCase()

  if (ownerEmail && ownerEmail === userEmail) return true
  if (await isOwnerViaUsernameAccount(admin, currentUser, ownerEmail)) return true
  if (currentUser.user_metadata?.is_admin) return true

  const { data, error } = await admin
    .from('user_tab_permissions')
    .select('is_admin')
    .eq('user_id', currentUser.id)
    .maybeSingle()

  if (error) {
    return !!currentUser.user_metadata?.is_admin
  }

  return !!data?.is_admin || !!currentUser.user_metadata?.is_admin
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

/**
 * Determines whether an identifier is a plain username (no @) or a real email.
 * Returns { isUsername, email, username }
 *
 * For plain usernames (e.g. "john.smith"):
 *   - email stored in Supabase: john.smith@login.local
 *   - username stored in user_metadata.username: john.smith
 *
 * For real emails (e.g. "john@school.org"):
 *   - email stored in Supabase: john@school.org
 *   - username in user_metadata: null (login form uses email directly)
 */
function resolveIdentifier(raw, fullName = '') {
  const trimmed = String(raw || '').trim().toLowerCase()
  if (!trimmed) return { isUsername: false, email: '', username: '' }

  const usernameFromFullName = normalizeUsername(fullName)

  if (trimmed.includes('@')) {
    return { isUsername: false, email: trimmed, username: usernameFromFullName }
  }

  // Plain username — generate internal Supabase email
  return {
    isUsername: true,
    email: `${trimmed}@login.local`,
    username: trimmed,
  }
}

async function backfillUsernames(admin, users, { ensureCurrentUserAdmin = null } = {}) {
  const { data: staffRows, error: staffError } = await admin
    .from('staff')
    .select('name, email')
    .is('deleted_at', null)
    .not('email', 'is', null)

  if (staffError) throw staffError

  const staffNameByEmail = new Map(
    (staffRows || [])
      .filter(row => row?.email)
      .map(row => [String(row.email).trim().toLowerCase(), String(row.name || '').trim()])
  )

  let updated = 0
  let alreadyCorrect = 0
  let preservedManual = 0
  let skippedMissingName = 0
  let failed = 0

  for (const user of users || []) {
    const internalEmail = String(user?.email || '').trim().toLowerCase()
    if (!internalEmail || internalEmail.endsWith('@login.local')) continue

    const metadata = user?.user_metadata || {}
    const existingUsernameRaw = String(metadata.username || '')
    const existingUsername = normalizeUsername(existingUsernameRaw)
    const wasAutogenerated = !!metadata.username_autogenerated

    const staffName = staffNameByEmail.get(internalEmail) || ''
    const existingFullName = String(metadata.full_name || '').trim()
    const sourceFullName = staffName || existingFullName
    const derivedUsername = normalizeUsername(sourceFullName)

    if (!derivedUsername) {
      skippedMissingName += 1
      continue
    }

    if (existingUsername && !wasAutogenerated) {
      preservedManual += 1
      continue
    }

    if (existingUsername === derivedUsername && wasAutogenerated) {
      alreadyCorrect += 1
      continue
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...metadata,
        ...(sourceFullName ? { full_name: sourceFullName } : {}),
        username: derivedUsername,
        username_autogenerated: true,
      },
    })

    if (updateError) {
      failed += 1
      continue
    }

    updated += 1
  }

  if (ensureCurrentUserAdmin?.id) {
    await admin.from('user_tab_permissions').upsert(
      {
        user_id: ensureCurrentUserAdmin.id,
        is_admin: true,
        can_view_timetable_overview: true,
        can_edit_timetable: true,
        can_view_safeguarding: true,
        allowed_tabs: sanitizeAllowedTabs(TAB_IDS),
      },
      { onConflict: 'user_id' }
    )

    const { data: currentUserData } = await admin.auth.admin.getUserById(ensureCurrentUserAdmin.id)
    if (currentUserData?.user) {
      await admin.auth.admin.updateUserById(ensureCurrentUserAdmin.id, {
        user_metadata: {
          ...(currentUserData.user.user_metadata || {}),
          is_admin: true,
        },
      })
    }
  }

  return {
    updated,
    alreadyCorrect,
    preservedManual,
    skippedMissingName,
    failed,
  }
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
        admin.from('user_tab_permissions').select('user_id, is_admin, allowed_tabs, can_view_timetable_overview, can_edit_timetable, can_view_safeguarding'),
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

          // Recover the original identifier:
          // If user_metadata.username is set, they log in with that username.
          // Otherwise they log in with their real email.
          const username = user.user_metadata?.username || ''
          const displayEmail = user.email || ''

          return {
            id: user.id,
            // If this is a username-based account, email will be "name@login.local" —
            // expose the username instead so the frontend shows the right thing.
            email: username ? '' : displayEmail,
            username,
            // The internal Supabase email (always present, used for account management)
            internalEmail: displayEmail,
            createdAt: user.created_at,
            lastSignInAt: user.last_sign_in_at,
            isArchived: archivedByMetadata || archivedByBan,
            isAdmin: !!row?.is_admin,
            canViewTimetableOverview: !!row?.can_view_timetable_overview,
            canEditTimetable: !!row?.can_edit_timetable,
            canViewSafeguarding: !!row?.can_view_safeguarding,
            fullName: user.user_metadata?.full_name || '',
            allowedTabs: sanitizeAllowedTabs(row?.allowed_tabs),
          }
        })
        .sort((a, b) => {
          const aLabel = a.username || a.email
          const bLabel = b.username || b.email
          return aLabel.localeCompare(bLabel)
        })

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
      // Accept either a real email or a plain username (firstname.lastname)
      const rawIdentifier = String(body.email || body.username || '').trim()
      const password = String(body.password || '')
      const isAdminInput = !!body.isAdmin
      const canViewTimetableOverviewInput = !!body.canViewTimetableOverview
      const canEditTimetableInput = !!body.canEditTimetable
      const canViewSafeguardingInput = !!body.canViewSafeguarding
      const allowedTabs = sanitizeAllowedTabs(body.allowedTabs)
      const fullName = String(body.fullName || '').trim()

      if (!rawIdentifier) return json(400, { error: 'An email or username is required' })
      if (password.length < 8) return json(400, { error: 'Password must be at least 8 characters' })

      const { isUsername, email, username } = resolveIdentifier(rawIdentifier, fullName)

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          must_change_password: true,
          ...(username ? { username } : {}),
          ...(!isUsername ? { username_autogenerated: !!username } : {}),
          ...(fullName ? { full_name: fullName } : {}),
        },
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
          can_edit_timetable: canEditTimetableInput,
          can_view_safeguarding: canViewSafeguardingInput,
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
          email: isUsername ? '' : email,
          username,
          internalEmail: email,
          isAdmin: isAdminInput,
          canViewTimetableOverview: canViewTimetableOverviewInput,
          canEditTimetable: canEditTimetableInput,
          canViewSafeguarding: canViewSafeguardingInput,
          allowedTabs,
        },
      })
    }

    if (action === 'backfill_usernames') {
      const authUsers = await listUsers(admin)
      const result = await backfillUsernames(admin, authUsers, {
        ensureCurrentUserAdmin: currentUser,
      })
      return json(200, { ok: true, ...result })
    }

    if (action === 'update_permissions') {
      const userId = String(body.userId || '')
      const isAdminInput = !!body.isAdmin
      const canViewTimetableOverviewInput = !!body.canViewTimetableOverview
      const canEditTimetableInput = !!body.canEditTimetable
      const allowedTabs = sanitizeAllowedTabs(body.allowedTabs)
      const fullName = String(body.fullName || '').trim()

      const canViewSafeguardingInput = !!body.canViewSafeguarding

      if (!userId) return json(400, { error: 'userId is required' })

      if (fullName) {
        const { data: targetData } = await admin.auth.admin.getUserById(userId)
        if (targetData?.user) {
          const targetEmail = String(targetData.user.email || '').toLowerCase()
          const shouldAutogenerateUsername = targetEmail.includes('@') && !targetEmail.endsWith('@login.local')
          const autogeneratedUsername = shouldAutogenerateUsername ? normalizeUsername(fullName) : ''

          await admin.auth.admin.updateUserById(userId, {
            user_metadata: {
              ...(targetData.user.user_metadata || {}),
              full_name: fullName,
              ...(shouldAutogenerateUsername ? { username: autogeneratedUsername || null, username_autogenerated: !!autogeneratedUsername } : {}),
            },
          })
        }
      }

      const { error } = await admin.from('user_tab_permissions').upsert(
        {
          user_id: userId,
          is_admin: isAdminInput,
          can_view_timetable_overview: canViewTimetableOverviewInput,
          can_edit_timetable: canEditTimetableInput,
          can_view_safeguarding: canViewSafeguardingInput,
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
      const rawIdentifier = String(body.email || body.username || '').trim()

      if (!userId) return json(400, { error: 'userId is required' })
      if (!rawIdentifier) return json(400, { error: 'An email or username is required' })

      const ownerEmail = (process.env.VITE_OWNER_EMAIL || '').toLowerCase()
      const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(userId)
      if (targetError) return json(400, { error: targetError.message })

      const targetUser = targetData?.user
      if (!targetUser) return json(404, { error: 'User not found' })

      const targetEmail = (targetUser.email || '').toLowerCase()
      if (ownerEmail && targetEmail === ownerEmail) {
        const { isUsername: newIsUsername, email: newEmail } = resolveIdentifier(rawIdentifier)
        if (!newIsUsername && newEmail !== ownerEmail) {
          return json(400, { error: 'Owner account email cannot be changed here' })
        }
      }

      const existingFullName = String(targetUser.user_metadata?.full_name || '').trim()
      const { isUsername, email, username } = resolveIdentifier(rawIdentifier, existingFullName)

      const { error } = await admin.auth.admin.updateUserById(userId, {
        email,
        user_metadata: {
          ...(targetUser.user_metadata || {}),
          ...(isUsername
            ? { username, username_autogenerated: false }
            : { username: username || null, username_autogenerated: !!username }),
        },
      })

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
    return json(error?.statusCode || 500, { error: error.message || 'Unexpected server error' })
  }
}
