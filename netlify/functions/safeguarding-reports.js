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

async function canViewSafeguarding(admin, currentUser) {
  const ownerEmail = (process.env.VITE_OWNER_EMAIL || '').toLowerCase()
  const userEmail = (currentUser.email || '').toLowerCase()

  if (ownerEmail && userEmail === ownerEmail) return true

  const [{ data: permissions, error: permissionsError }, { data: staffRow, error: staffError }] = await Promise.all([
    admin
      .from('user_tab_permissions')
      .select('is_admin')
      .eq('user_id', currentUser.id)
      .maybeSingle(),
    admin
      .from('staff')
      .select('role')
      .ilike('email', userEmail)
      .is('deleted_at', null)
      .maybeSingle(),
  ])

  if (permissionsError && permissionsError.code !== 'PGRST116') {
    console.error('SAFEGUARDING PERMISSIONS ERROR:', permissionsError.message)
  }
  if (staffError && staffError.code !== 'PGRST116') {
    console.error('SAFEGUARDING STAFF LOOKUP ERROR:', staffError.message)
  }

  if (permissions?.is_admin) return true

  const role = (staffRow?.role || '').trim().toLowerCase()
  return role === 'camp coordinator' || role === 'director'
}

function isOwnerUser(currentUser) {
  const ownerEmail = (process.env.VITE_OWNER_EMAIL || '').toLowerCase()
  const userEmail = (currentUser?.email || '').toLowerCase()
  return Boolean(ownerEmail) && ownerEmail === userEmail
}

function toBufferFromDataUrl(base64Pdf) {
  const cleanBase64 = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf
  return Buffer.from(cleanBase64, 'base64')
}

async function syncParticipantFlag(admin, participantId) {
  const { count, error } = await admin
    .from('safeguarding_reports')
    .select('id', { count: 'exact', head: true })
    .eq('participant_id', participantId)
    .eq('status', 'open')

  if (error) throw error

  const flag = (count || 0) > 0

  const { error: updateError } = await admin
    .from('participants')
    .update({ safeguarding_flag: flag })
    .eq('id', participantId)

  if (updateError) throw updateError
}

async function syncParticipantFlags(admin, participantIds) {
  const uniqueIds = [...new Set((participantIds || []).filter(Boolean))]
  await Promise.all(uniqueIds.map(id => syncParticipantFlag(admin, id)))
}

async function resolveReportByIdOrIncidentId(admin, reportId, incidentId) {
  let query = admin
    .from('safeguarding_reports')
    .select('id, participant_id, incident_id, status, storage_path')

  if (reportId) {
    query = query.eq('id', reportId)
  } else if (incidentId) {
    query = query.eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(1)
  } else {
    throw new Error('reportId or incidentId is required')
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Safeguarding report not found')
  return data
}

async function setIncidentResolvedState(admin, incidentId, isResolved, actorInitials = '') {
  if (!incidentId) return

  const payload = isResolved
    ? {
        resolved_at: new Date().toISOString(),
        resolved_by: actorInitials || null,
      }
    : {
        resolved_at: null,
        resolved_by: null,
      }

  const { error } = await admin
    .from('incidents')
    .update(payload)
    .eq('id', incidentId)

  if (error) {
    console.error('SAFEGUARDING INCIDENT SYNC ERROR:', error.message)
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

    if (event.httpMethod === 'GET') {
      const authorized = await canViewSafeguarding(admin, currentUser)
      if (!authorized) {
        return json(403, { error: 'Safeguarding access required' })
      }

      const { data, error } = await admin
        .from('safeguarding_reports')
        .select('id, participant_id, incident_id, status, report_name, storage_path, raised_by_email, created_at, closed_at')
        .order('created_at', { ascending: false })

      if (error) return json(500, { error: error.message })

      const incidentIds = [...new Set((data || []).map(row => row.incident_id).filter(Boolean))]
      const { data: incidents, error: incidentsError } = incidentIds.length === 0
        ? { data: [], error: null }
        : await admin.from('incidents').select('id, resolved_at, resolved_by').in('id', incidentIds)

      if (incidentsError) return json(500, { error: incidentsError.message })

      const participantIds = [...new Set((data || []).map(row => row.participant_id).filter(Boolean))]
      const { data: participants, error: participantsError } = participantIds.length === 0
        ? { data: [], error: null }
        : await admin.from('participants').select('id, name').in('id', participantIds)

      if (participantsError) return json(500, { error: participantsError.message })

      const participantMap = new Map((participants || []).map(row => [row.id, row.name]))
      const incidentMap = new Map((incidents || []).map(row => [row.id, row]))

      return json(200, {
        reports: (data || []).map(row => ({
          const incident = incidentMap.get(row.incident_id)
          const isResolved = row.status === 'closed' || Boolean(incident?.resolved_at)
          return {
          id: row.id,
          participantId: row.participant_id,
          participantName: participantMap.get(row.participant_id) || 'Unknown participant',
          incidentId: row.incident_id,
          status: isResolved ? 'closed' : 'open',
          reportName: row.report_name,
          raisedByEmail: row.raised_by_email,
          createdAt: row.created_at,
          closedAt: row.closed_at || incident?.resolved_at || null,
          resolvedBy: incident?.resolved_by || null,
        }
        }),
      })
    }

    const parsed = parseJsonBody(event.body)
    if (!parsed.ok) {
      return json(400, { error: 'Request body must be valid JSON' })
    }

    const body = parsed.data
    const action = body.action

    if (action === 'create_report') {
      const participantId = String(body.participantId || '')
      const incidentId = String(body.incidentId || '')
      const reportName = String(body.reportName || '').trim()
      const base64Pdf = String(body.base64Pdf || '')
      const mimeType = String(body.mimeType || 'application/pdf')

      if (!participantId) return json(400, { error: 'participantId is required' })
      if (!incidentId) return json(400, { error: 'incidentId is required' })
      if (!reportName) return json(400, { error: 'reportName is required' })
      if (!base64Pdf) return json(400, { error: 'base64Pdf is required' })

      const filePath = `safeguarding/${incidentId}-${reportName.replace(/[^a-zA-Z0-9._-]/g, '-')}`
      const buffer = toBufferFromDataUrl(base64Pdf)

      const { error: uploadError } = await admin.storage
        .from('documents')
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        })

      if (uploadError) return json(500, { error: uploadError.message })

      const { data: existingReport, error: existingError } = await admin
        .from('safeguarding_reports')
        .select('id, storage_path')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingError && existingError.code !== 'PGRST116') {
        return json(500, { error: existingError.message })
      }

      if (existingReport?.storage_path && existingReport.storage_path !== filePath) {
        await admin.storage.from('documents').remove([existingReport.storage_path])
      }

      if (existingReport?.id) {
        const { error: updateError } = await admin
          .from('safeguarding_reports')
          .update({
            participant_id: participantId,
            report_name: reportName,
            storage_path: filePath,
            raised_by_user_id: currentUser.id,
            raised_by_email: currentUser.email || '',
            status: 'open',
            closed_at: null,
            closed_by_user_id: null,
          })
          .eq('id', existingReport.id)

        if (updateError) return json(500, { error: updateError.message })

        await admin
          .from('participants')
          .update({ safeguarding_flag: true })
          .eq('id', participantId)

        return json(200, { ok: true, reportId: existingReport.id })
      }

      const { data: report, error: insertError } = await admin
        .from('safeguarding_reports')
        .insert({
          participant_id: participantId,
          incident_id: incidentId,
          status: 'open',
          report_name: reportName,
          storage_path: filePath,
          raised_by_user_id: currentUser.id,
          raised_by_email: currentUser.email || '',
        })
        .select('id')
        .single()

      if (insertError) return json(500, { error: insertError.message })

      await admin
        .from('participants')
        .update({ safeguarding_flag: true })
        .eq('id', participantId)

      return json(200, { ok: true, reportId: report.id })
    }

    const authorized = await canViewSafeguarding(admin, currentUser)
    if (!authorized) {
      return json(403, { error: 'Safeguarding access required' })
    }

    if (action === 'get_download_url') {
      const reportId = String(body.reportId || '')
      const incidentId = String(body.incidentId || '')

      let query = admin
        .from('safeguarding_reports')
        .select('storage_path')

      if (reportId) {
        query = query.eq('id', reportId)
      } else if (incidentId) {
        query = query.eq('incident_id', incidentId).order('created_at', { ascending: false }).limit(1)
      } else {
        return json(400, { error: 'reportId or incidentId is required' })
      }

      const { data, error } = await query.single()

      if (error) return json(500, { error: error.message })

      const { data: signed, error: signedError } = await admin.storage
        .from('documents')
        .createSignedUrl(data.storage_path, 60)

      if (signedError) return json(500, { error: signedError.message })

      return json(200, { url: signed.signedUrl })
    }

    if (action === 'close_report') {
      const reportId = String(body.reportId || '')
      const incidentId = String(body.incidentId || '')
      const actorInitials = String(body.actorInitials || '').trim().toUpperCase()
      let report
      try {
        report = await resolveReportByIdOrIncidentId(admin, reportId, incidentId)
      } catch (error) {
        return json(400, { error: error.message })
      }

      const { data, error } = await admin
        .from('safeguarding_reports')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by_user_id: currentUser.id,
        })
        .eq('id', report.id)
        .select('participant_id')
        .single()

      if (error) return json(500, { error: error.message })

      await setIncidentResolvedState(admin, report.incident_id, true, actorInitials)
      await syncParticipantFlag(admin, data.participant_id)
      return json(200, { ok: true })
    }

    if (action === 'reopen_report') {
      const reportId = String(body.reportId || '')
      const incidentId = String(body.incidentId || '')
      let report
      try {
        report = await resolveReportByIdOrIncidentId(admin, reportId, incidentId)
      } catch (error) {
        return json(400, { error: error.message })
      }

      const { data, error } = await admin
        .from('safeguarding_reports')
        .update({
          status: 'open',
          closed_at: null,
          closed_by_user_id: null,
        })
        .eq('id', report.id)
        .select('participant_id')
        .single()

      if (error) return json(500, { error: error.message })

      await setIncidentResolvedState(admin, report.incident_id, false)
      await syncParticipantFlag(admin, data.participant_id)
      return json(200, { ok: true })
    }

    if (action === 'clear_reports') {
      if (!isOwnerUser(currentUser)) {
        return json(403, { error: 'Only the owner account can clear safeguarding logs' })
      }

      const scope = String(body.scope || '')
      const confirmPhrase = String(body.confirmPhrase || '')

      if (!['closed', 'all'].includes(scope)) {
        return json(400, { error: 'scope must be closed or all' })
      }

      const expectedPhrase = scope === 'all' ? 'DELETE ALL SAFEGUARDING LOGS' : 'DELETE CLOSED SAFEGUARDING LOGS'
      if (confirmPhrase !== expectedPhrase) {
        return json(400, { error: `Confirmation phrase must be exactly: ${expectedPhrase}` })
      }

      let query = admin
        .from('safeguarding_reports')
        .select('id, participant_id, storage_path')

      if (scope === 'closed') {
        query = query.eq('status', 'closed')
      }

      const { data: rows, error: rowsError } = await query
      if (rowsError) return json(500, { error: rowsError.message })

      if (!rows || rows.length === 0) {
        return json(200, { ok: true, deletedCount: 0 })
      }

      const storagePaths = rows.map(row => row.storage_path).filter(Boolean)
      if (storagePaths.length > 0) {
        const { error: removeError } = await admin.storage
          .from('documents')
          .remove(storagePaths)
        if (removeError) {
          return json(500, { error: removeError.message })
        }
      }

      const ids = rows.map(row => row.id)
      const { error: deleteError } = await admin
        .from('safeguarding_reports')
        .delete()
        .in('id', ids)

      if (deleteError) return json(500, { error: deleteError.message })

      const participantIds = rows.map(row => row.participant_id)
      await syncParticipantFlags(admin, participantIds)

      return json(200, {
        ok: true,
        deletedCount: rows.length,
      })
    }

    if (action === 'delete_report') {
      if (!isOwnerUser(currentUser)) {
        return json(403, { error: 'Only the owner account can delete safeguarding reports' })
      }

      const reportId = String(body.reportId || '')
      const confirmPhrase = String(body.confirmPhrase || '')
      const expectedPhrase = 'DELETE SAFEGUARDING REPORT'

      if (!reportId) return json(400, { error: 'reportId is required' })
      if (confirmPhrase !== expectedPhrase) {
        return json(400, { error: `Confirmation phrase must be exactly: ${expectedPhrase}` })
      }

      const { data: row, error: rowError } = await admin
        .from('safeguarding_reports')
        .select('id, participant_id, storage_path')
        .eq('id', reportId)
        .maybeSingle()

      if (rowError) return json(500, { error: rowError.message })
      if (!row) return json(404, { error: 'Safeguarding report not found' })

      if (row.storage_path) {
        const { error: removeError } = await admin.storage
          .from('documents')
          .remove([row.storage_path])
        if (removeError) return json(500, { error: removeError.message })
      }

      const { error: deleteError } = await admin
        .from('safeguarding_reports')
        .delete()
        .eq('id', reportId)

      if (deleteError) return json(500, { error: deleteError.message })

      await syncParticipantFlag(admin, row.participant_id)
      return json(200, { ok: true, deletedCount: 1 })
    }

    return json(400, { error: 'Unknown action' })
  } catch (error) {
    return json(500, { error: error.message || 'Unexpected server error' })
  }
}
