import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import Login from './components/Login'
import Nav, { NAV_ITEMS } from './components/Nav'
const loadDashboard = () => import('./components/Dashboard')
const loadSignInOut = () => import('./components/SignInOut')
const loadSharedInfo = () => import('./components/SharedInfo')
const loadParticipants = () => import('./components/Participants')
const loadParticipantDetail = () => import('./components/ParticipantDetail')
const loadStarOfTheDay = () => import('./components/StarOfTheDay')
const loadParents = () => import('./components/Parents')
const loadMedical = () => import('./components/Medical')
const loadBehaviourLogs = () => import('./components/BehaviourLogs')
const loadTimetable = () => import('./components/Timetable')
const loadIncidents = () => import('./components/Incidents')
const loadAttendanceOverview = () => import('./components/AttendanceOverview')
const loadStaff = () => import('./components/Staff')
const loadDressingRooms = () => import('./components/DressingRooms')
const loadDocuments = () => import('./components/Documents')

const Dashboard = lazy(loadDashboard)
const SignInOut = lazy(loadSignInOut)
const SharedInfo = lazy(loadSharedInfo)
const Participants = lazy(loadParticipants)
const ParticipantDetail = lazy(loadParticipantDetail)
const StarOfTheDay = lazy(loadStarOfTheDay)
const Parents = lazy(loadParents)
const Medical = lazy(loadMedical)
const BehaviourLogs = lazy(loadBehaviourLogs)
const Timetable = lazy(loadTimetable)
const Incidents = lazy(loadIncidents)
const AttendanceOverview = lazy(loadAttendanceOverview)
const Staff = lazy(loadStaff)
const DressingRooms = lazy(loadDressingRooms)
const Documents = lazy(loadDocuments)

export const CAMP_NAME = 'Impact Kidz Summer Camp'
export const STAFF_PASSWORD = import.meta.env.VITE_STAFF_PASSWORD || ''
const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || '').toLowerCase()
const BASIC_TABS = ['dashboard', 'signin', 'shared-info']
const ALL_TABS = NAV_ITEMS.map(item => item.id)
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000
const SESSION_WARNING_SECONDS = 60
const TABLE_CACHE_TTL_MS = 30 * 1000
const SESSION_CHECK_TIMEOUT_MS = 6000
const tableCache = new Map()
const ROUTE_PREFETCHERS = {
  dashboard: loadDashboard,
  signin: loadSignInOut,
  'shared-info': loadSharedInfo,
  attendance: loadAttendanceOverview,
  'star-of-day': loadStarOfTheDay,
  participants: loadParticipants,
  participant: loadParticipantDetail,
  parents: loadParents,
  'dressing-rooms': loadDressingRooms,
  medical: loadMedical,
  behaviour: loadBehaviourLogs,
  timetable: loadTimetable,
  incidents: loadIncidents,
  staff: loadStaff,
  documents: loadDocuments,
}
const TAB_PATHS = {
  dashboard: '/dashboard',
  signin: '/signin',
  'shared-info': '/shared-info',
  attendance: '/attendance',
  'star-of-day': '/star-of-day',
  participants: '/participants',
  parents: '/parents',
  'dressing-rooms': '/dressing-rooms',
  medical: '/medical',
  behaviour: '/behaviour',
  timetable: '/timetable',
  incidents: '/incidents',
  staff: '/staff',
  documents: '/documents',
}
const PATH_TO_TAB = Object.fromEntries(Object.entries(TAB_PATHS).map(([tabId, path]) => [path, tabId]))

function getRouteState(pathname) {
  const normalizedPath = pathname ? pathname.replace(/\/+$/, '') || '/' : '/'

  if (normalizedPath === '/') {
    return { page: 'dashboard', participantId: null, isKnownRoute: true }
  }

  if (normalizedPath.startsWith('/participants/')) {
    const participantId = decodeURIComponent(normalizedPath.slice('/participants/'.length))
    return {
      page: 'participant',
      participantId: participantId || null,
      isKnownRoute: Boolean(participantId),
    }
  }

  const tabId = PATH_TO_TAB[normalizedPath]
  if (tabId) {
    return { page: tabId, participantId: null, isKnownRoute: true }
  }

  return { page: 'dashboard', participantId: null, isKnownRoute: false }
}

function pathForPage(page, participantId = null) {
  if (page === 'participant' && participantId) {
    return `/participants/${encodeURIComponent(participantId)}`
  }
  return TAB_PATHS[page] || TAB_PATHS.dashboard
}

function useSupabaseTable(table, orderBy = 'created_at', options = {}) {
  const { softDelete = false, enabled = true, cacheScope = 'anon' } = options
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(enabled)
  const cacheKey = `${cacheScope}|${table}|${orderBy}|${softDelete ? '1' : '0'}`

  async function load() {
    if (!enabled) return
    try {
      let query = supabase.from(table).select('*').order(orderBy)
      if (softDelete) query = query.is('deleted_at', null)
      const { data: rows, error } = await Promise.race([
        query,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`${table} load timed out`)), 15000)
        }),
      ])
      if (error) {
        console.error(`${table.toUpperCase()} LOAD ERROR:`, error.message)
        return
      }
      const nextRows = rows || []
      setData(nextRows)
      tableCache.set(cacheKey, { rows: nextRows, ts: Date.now() })
    } catch (error) {
      console.error(`${table.toUpperCase()} LOAD EXCEPTION:`, error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!enabled) {
      setData([])
      setLoading(false)
      return
    }
    const cached = tableCache.get(cacheKey)
    const hasFreshCache = Boolean(cached) && (Date.now() - cached.ts < TABLE_CACHE_TTL_MS)

    if (hasFreshCache) {
      setData(cached.rows)
      setLoading(false)
    } else {
      setLoading(true)
      load()
    }

    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [table, orderBy, softDelete, enabled, cacheKey])

  return [data, setData, loading, load]
}

function toSnake(obj) {
  const map = {
    parentName: 'parent_name', parentEmail: 'parent_email', parentPhone: 'parent_phone',
    approvedAdults: 'approved_adults', medicalType: 'medical_type', medicalDetails: 'medical_details',
    sendNeeds: 'send_needs', sendDiagnosed: 'send_diagnosed', sendDiagnosis: 'send_diagnosis', dressingRoom: 'dressing_room',
    safeguardingFlag: 'safeguarding_flag',
    photoConsent: 'photo_consent', firstAidConsent: 'first_aid_consent', otcConsent: 'otc_consent',
    participantNotesHistory: 'participant_notes_history', participantDocuments: 'participant_documents',
    otcAllowedItems: 'otc_allowed_items', otcNotes: 'otc_notes',
    dietaryType: 'dietary_type', allergyDetails: 'allergy_details', mealAdjustments: 'meal_adjustments',
    allergenMatrix: 'allergen_matrix', mealSafeTags: 'meal_safe_tags',
    castPart: 'cast_part', costume: 'costume',
    participantId: 'participant_id', signIn: 'sign_in', signOut: 'sign_out',
    signInBy: 'sign_in_by', signOutBy: 'sign_out_by',
    loggedAt: 'logged_at', triggerText: 'trigger_text', actionTaken: 'action_taken', escalatedIncidentId: 'escalated_incident_id',
    staffInitials: 'staff_initials',
    dayDate: 'day_date', startTime: 'start_time', endTime: 'end_time',
    activityName: 'activity_name', groupName: 'group_name', leadStaff: 'lead_staff', assignedEmail: 'assigned_email',
    assignedEmails: 'assigned_emails', spaceName: 'space_name', locationDetail: 'location_detail',
    exceptionReason: 'exception_reason', exceptionNotes: 'exception_notes',
    collectedBy: 'collected_by', staffMember: 'staff_member', pdfName: 'pdf_name',
    pdfData: 'pdf_data', emergencyContact: 'emergency_contact', emergencyPhone: 'emergency_phone',
    incidentNotes: 'incident_notes', incidentDocuments: 'incident_documents',
    followUpRequired: 'follow_up_required', followUpDueDate: 'follow_up_due_date',
    followUpCompletedAt: 'follow_up_completed_at', followUpCompletedBy: 'follow_up_completed_by',
    resolvedAt: 'resolved_at', resolvedBy: 'resolved_by',
    createdByInitials: 'created_by_initials', updatedByInitials: 'updated_by_initials',
    createdByUserId: 'created_by_user_id', updatedByUserId: 'updated_by_user_id',
    uploadedByInitials: 'uploaded_by_initials',
    firstAidTrained: 'first_aid_trained', safeguardingTrained: 'safeguarding_trained',
    firstAidExpiresOn: 'first_aid_expires_on', safeguardingExpiresOn: 'safeguarding_expires_on',
    isActiveThisSeason: 'is_active_this_season', isAssignedThisSeason: 'is_assigned_this_season',
    awardDate: 'award_date',
    createdAt: 'created_at', updatedAt: 'updated_at',
    sortOrder: 'sort_order',
  }
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'pdfPayload') continue
    result[map[k] || k] = v
  }
  // Only process age if it exists in the input object (for participants table)
  if ('age' in obj) {
    if (result.age === '' || result.age === undefined) result.age = null
    if (result.age !== null) result.age = parseInt(result.age) || null
  }

  // Normalize optional date fields so Postgres date columns never receive empty strings.
  const nullableDateKeys = [
    'first_aid_expires_on',
    'safeguarding_expires_on',
    'follow_up_due_date',
  ]
  for (const key of nullableDateKeys) {
    if (result[key] === '') result[key] = null
  }

  return result
}

function attendanceToSnake(obj) {
  const map = {
    participantId: 'participant_id', 
    signIn: 'sign_in', 
    signOut: 'sign_out',
    signInBy: 'sign_in_by',
    signOutBy: 'sign_out_by',
    exceptionReason: 'exception_reason',
    exceptionNotes: 'exception_notes',
    collectedBy: 'collected_by',
    createdAt: 'created_at',
  }
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k in map) {
      result[map[k]] = v
    } else {
      result[k] = v // Keep original key if not in map
    }
  }
  return result
}

function toCamel(obj) {
  const map = {
    parent_name: 'parentName', parent_email: 'parentEmail', parent_phone: 'parentPhone',
    approved_adults: 'approvedAdults', medical_type: 'medicalType', medical_details: 'medicalDetails',
    send_needs: 'sendNeeds', send_diagnosed: 'sendDiagnosed', send_diagnosis: 'sendDiagnosis', dressing_room: 'dressingRoom',
    safeguarding_flag: 'safeguardingFlag',
    photo_consent: 'photoConsent', first_aid_consent: 'firstAidConsent', otc_consent: 'otcConsent',
    participant_notes_history: 'participantNotesHistory', participant_documents: 'participantDocuments',
    otc_allowed_items: 'otcAllowedItems', otc_notes: 'otcNotes',
    dietary_type: 'dietaryType', allergy_details: 'allergyDetails', meal_adjustments: 'mealAdjustments',
    allergen_matrix: 'allergenMatrix', meal_safe_tags: 'mealSafeTags',
    cast_part: 'castPart', costume: 'costume',
    participant_id: 'participantId', sign_in: 'signIn', sign_out: 'signOut',
    sign_in_by: 'signInBy', sign_out_by: 'signOutBy',
    logged_at: 'loggedAt', trigger_text: 'triggerText', action_taken: 'actionTaken', escalated_incident_id: 'escalatedIncidentId',
    staff_initials: 'staffInitials',
    day_date: 'dayDate', start_time: 'startTime', end_time: 'endTime',
    activity_name: 'activityName', group_name: 'groupName', lead_staff: 'leadStaff', assigned_email: 'assignedEmail',
    assigned_emails: 'assignedEmails', space_name: 'spaceName', location_detail: 'locationDetail',
    exception_reason: 'exceptionReason', exception_notes: 'exceptionNotes',
    collected_by: 'collectedBy', staff_member: 'staffMember', pdf_name: 'pdfName',
    pdf_data: 'pdfData', emergency_contact: 'emergencyContact', emergency_phone: 'emergencyPhone',
    incident_notes: 'incidentNotes', incident_documents: 'incidentDocuments',
    follow_up_required: 'followUpRequired', follow_up_due_date: 'followUpDueDate',
    follow_up_completed_at: 'followUpCompletedAt', follow_up_completed_by: 'followUpCompletedBy',
    resolved_at: 'resolvedAt', resolved_by: 'resolvedBy',
    created_by_initials: 'createdByInitials', updated_by_initials: 'updatedByInitials',
    uploaded_by_initials: 'uploadedByInitials',
    first_aid_trained: 'firstAidTrained', safeguarding_trained: 'safeguardingTrained',
    first_aid_expires_on: 'firstAidExpiresOn', safeguarding_expires_on: 'safeguardingExpiresOn',
    is_active_this_season: 'isActiveThisSeason', is_assigned_this_season: 'isAssignedThisSeason',
    award_date: 'awardDate',
    created_at: 'createdAt', updated_at: 'updatedAt',
    sort_order: 'sortOrder',
  }
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    result[map[k] || k] = v
  }
  return result
}

export default function App() {
  const location = useLocation()
  const routerNavigate = useNavigate()
  useEffect(() => {
    function handlePageShow(event) {
      if (event.persisted) {
        window.location.reload()
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])
  const [authed, setAuthed] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  const [allowedTabIds, setAllowedTabIds] = useState(BASIC_TABS)
    const [canViewTimetableOverview, setCanViewTimetableOverview] = useState(false)
  const [canEditTimetable, setCanEditTimetable] = useState(false)
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const [warningCountdown, setWarningCountdown] = useState(SESSION_WARNING_SECONDS)
  const [forcePassword, setForcePassword] = useState('')
  const [forcePasswordConfirm, setForcePasswordConfirm] = useState('')
  const [forcePasswordSaving, setForcePasswordSaving] = useState(false)
  const [forcePasswordError, setForcePasswordError] = useState('')
  const [attendanceError, setAttendanceError] = useState('')
  const [schemaWarnings, setSchemaWarnings] = useState([])
  const authWatchdogRef = useRef(null)
  const permissionsWatchdogRef = useRef(null)
  const inactivityTimeoutRef = useRef(null)
  const warningIntervalRef = useRef(null)
  const prefetchedRoutesRef = useRef(new Set())
  const routeState = getRouteState(location.pathname)
  const page = routeState.page
  const selectedParticipantId = routeState.participantId
  const tableCacheScope = currentUser?.id || 'anon'
  const tableQueriesEnabled = authed && !authLoading

  const needsParticipants = ['dashboard', 'signin', 'shared-info', 'attendance', 'star-of-day', 'participants', 'participant', 'parents', 'dressing-rooms', 'medical', 'incidents', 'behaviour'].includes(page)
  const needsAttendance = ['dashboard', 'signin', 'attendance', 'participant'].includes(page)
  const needsIncidents = ['dashboard', 'signin', 'participant', 'incidents', 'behaviour'].includes(page)
  const needsBehaviourLogs = ['behaviour'].includes(page)
  const needsTimetable = ['timetable'].includes(page)
  const needsStarOfDay = ['star-of-day'].includes(page)
  const needsStaff = ['participant', 'incidents', 'staff', 'documents', 'timetable'].includes(page) || permissionsLoading

  const [rawParticipants, , loadingP, reloadP] = useSupabaseTable('participants', 'created_at', { softDelete: true, enabled: tableQueriesEnabled && needsParticipants, cacheScope: tableCacheScope })
  const [rawAttendance, , loadingA, reloadA] = useSupabaseTable('attendance', 'date', { enabled: tableQueriesEnabled && needsAttendance, cacheScope: tableCacheScope })
  const [rawIncidents, , loadingI, reloadI] = useSupabaseTable('incidents', 'created_at', { softDelete: true, enabled: tableQueriesEnabled && needsIncidents, cacheScope: tableCacheScope })
  const [rawBehaviourLogs, , loadingBL, reloadBL] = useSupabaseTable('behaviour_logs', 'logged_at', { enabled: tableQueriesEnabled && needsBehaviourLogs, cacheScope: tableCacheScope })
  const [rawTimetableEntries, , loadingT, reloadT] = useSupabaseTable('daily_timetable_entries', 'day_date', { enabled: tableQueriesEnabled && needsTimetable, cacheScope: tableCacheScope })
  const [rawTimetableSpaces, , loadingTS, reloadTS] = useSupabaseTable('timetable_spaces', 'name', { enabled: tableQueriesEnabled && needsTimetable, cacheScope: tableCacheScope })
  const [rawStarAwards, setRawStarAwardsState, loadingStar, reloadStar] = useSupabaseTable('star_of_day_awards', 'award_date', { enabled: tableQueriesEnabled && needsStarOfDay, cacheScope: tableCacheScope })
  const [rawStaff, , loadingS, reloadS] = useSupabaseTable('staff', 'created_at', { softDelete: true, enabled: tableQueriesEnabled && needsStaff, cacheScope: tableCacheScope })

  const participants = rawParticipants.map(toCamel)
  const attendance = rawAttendance.map(toCamel)
  const incidents = rawIncidents.map(toCamel)
  const behaviourLogs = rawBehaviourLogs.map(toCamel)
  const timetableEntries = rawTimetableEntries.map(toCamel)
  const timetableSpaces = rawTimetableSpaces.map(toCamel)
  const starAwards = rawStarAwards.map(toCamel)
  const staffList = rawStaff.map(toCamel)

  const loading = (needsParticipants && loadingP) || (needsAttendance && loadingA) || (needsIncidents && loadingI) || (needsBehaviourLogs && loadingBL) || (needsTimetable && (loadingT || loadingTS)) || (needsStarOfDay && loadingStar) || (needsStaff && loadingS)

  function isMissingUpdatedAtColumnError(error) {
    const message = String(error?.message || '').toLowerCase()
    return message.includes('updated_at') && message.includes('does not exist')
  }

  function isMissingColumnError(error, columnName) {
    const message = String(error?.message || '').toLowerCase()
    return message.includes(String(columnName || '').toLowerCase()) && message.includes('does not exist')
  }

  function initialsFromName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'ST'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
  }

  function firstNameFromName(name) {
    return String(name || '').trim().split(/\s+/).filter(Boolean)[0] || ''
  }

  function stripMissingColumn(error, payload) {
    const match = String(error?.message || '').match(/column "([^"]+)" of relation "[^"]+" does not exist/)
    if (!match) return null
    const col = match[1]
    const { [col]: _dropped, ...rest } = payload
    return rest
  }

  async function setParticipants(updater) {
    const next = typeof updater === 'function' ? updater(participants) : updater
    const added = next.filter(p => !participants.find(x => x.id === p.id))
    const removed = participants.filter(p => !next.find(x => x.id === p.id))
    const changed = next.filter(p => {
      const old = participants.find(x => x.id === p.id)
      return old && JSON.stringify(old) !== JSON.stringify(p)
    })
    for (const p of added) {
      const { id, ...rest } = toSnake(p)
      let payload = { id: p.id, ...rest }
      let { error } = await supabase.from('participants').insert(payload)
      while (error && String(error.message).includes('does not exist')) {
        const stripped = stripMissingColumn(error, payload)
        if (!stripped) break
        payload = stripped
        ;({ error } = await supabase.from('participants').insert(payload))
      }
      if (error) console.error('INSERT ERROR:', error.message, error.details, error.hint)
    }
    for (const p of removed) {
      await supabase.from('participants').update({ deleted_at: new Date().toISOString() }).eq('id', p.id)
    }
    for (const p of changed) {
      const { id, ...rest } = toSnake(p)
      let payload = rest
      let { error } = await supabase.from('participants').update(payload).eq('id', p.id)
      while (error && String(error.message).includes('does not exist')) {
        const stripped = stripMissingColumn(error, payload)
        if (!stripped) break
        payload = stripped
        ;({ error } = await supabase.from('participants').update(payload).eq('id', p.id))
      }
      if (error) console.error('UPDATE ERROR:', error.message, error.details, error.hint)
    }
    reloadP()
  }

  async function setAttendance(updater) {
    let firstError = null

    const next = typeof updater === 'function' ? updater(attendance) : updater
    const added = next.filter(a => !attendance.find(x => x.id === a.id))
    const changed = next.filter(a => {
      const old = attendance.find(x => x.id === a.id)
      return old && JSON.stringify(old) !== JSON.stringify(a)
    })
    const removed = attendance.filter(a => !next.find(x => x.id === a.id))
    for (const a of added) {
      const payload = attendanceToSnake(a)
      let { error } = await supabase.from('attendance').insert(payload)
      if (error && (isMissingColumnError(error, 'sign_in_by') || isMissingColumnError(error, 'sign_out_by'))) {
        const { sign_in_by, sign_out_by, ...fallbackPayload } = payload
        const fallback = await supabase.from('attendance').insert(fallbackPayload)
        error = fallback.error
      }
      if (error) {
        console.error('ATTENDANCE INSERT ERROR:', error.message)
        if (!firstError) firstError = new Error(error.message || 'Attendance insert failed')
      }
    }
    for (const a of changed) {
      const { id, ...rest } = attendanceToSnake(a)
      let { error } = await supabase.from('attendance').update(rest).eq('id', a.id)
      if (error && (isMissingColumnError(error, 'sign_in_by') || isMissingColumnError(error, 'sign_out_by'))) {
        const { sign_in_by, sign_out_by, ...fallbackRest } = rest
        const fallback = await supabase.from('attendance').update(fallbackRest).eq('id', a.id)
        error = fallback.error
      }
      if (error) {
        console.error('ATTENDANCE UPDATE ERROR:', error.message)
        if (!firstError) firstError = new Error(error.message || 'Attendance update failed')
      }
    }
    for (const a of removed) {
      const { error } = await supabase.from('attendance').delete().eq('id', a.id)
      if (error) {
        console.error('ATTENDANCE DELETE ERROR:', error.message)
        if (!firstError) firstError = new Error(error.message || 'Attendance delete failed')
      }
    }
    reloadA()

    if (firstError) {
      setAttendanceError(`Attendance changes could not be fully saved: ${firstError.message}`)
      return
    }

    setAttendanceError('')
  }

  async function setIncidents(updater) {
    const next = typeof updater === 'function' ? updater(incidents) : updater
    const added = next.filter(i => !incidents.find(x => x.id === i.id))
    const removed = incidents.filter(i => !next.find(x => x.id === i.id))
    const changed = next.filter(i => {
      const old = incidents.find(x => x.id === i.id)
      return old && JSON.stringify(old) !== JSON.stringify(i)
    })

    for (const inc of added) {
      const { id, ...rest } = toSnake(inc)
      delete rest.updated_at
      let { error } = await supabase.from('incidents').insert({ id: inc.id, ...rest })
      if (error && (
        isMissingColumnError(error, 'created_by_initials')
        || isMissingColumnError(error, 'updated_by_initials')
        || isMissingColumnError(error, 'created_by_user_id')
        || isMissingColumnError(error, 'updated_by_user_id')
        || isMissingColumnError(error, 'resolved_at')
        || isMissingColumnError(error, 'resolved_by')
        || isMissingColumnError(error, 'incident_notes')
        || isMissingColumnError(error, 'incident_documents')
      )) {
        const {
          created_by_initials,
          updated_by_initials,
          created_by_user_id,
          updated_by_user_id,
          resolved_at,
          resolved_by,
          incident_notes,
          incident_documents,
          ...fallbackRest
        } = rest
        const fallback = await supabase.from('incidents').insert({ id: inc.id, ...fallbackRest })
        error = fallback.error
      }
      if (error) {
        console.error('INCIDENT INSERT ERROR:', error.message)
        throw new Error(`Failed to save incident: ${error.message}`)
      }
    }
    for (const inc of changed) {
      const { id, ...rest } = toSnake(inc)
      const withUpdatedAt = { ...rest, updated_at: new Date().toISOString() }
      let { error } = await supabase.from('incidents').update(withUpdatedAt).eq('id', inc.id)
      if (error && (
        isMissingUpdatedAtColumnError(error)
        || isMissingColumnError(error, 'updated_by_initials')
        || isMissingColumnError(error, 'updated_by_user_id')
        || isMissingColumnError(error, 'resolved_at')
        || isMissingColumnError(error, 'resolved_by')
        || isMissingColumnError(error, 'incident_notes')
        || isMissingColumnError(error, 'incident_documents')
      )) {
        // Backward-compatible fallback before the updated_at migration is applied.
        const {
          updated_by_initials,
          updated_by_user_id,
          resolved_at,
          resolved_by,
          incident_notes,
          incident_documents,
          ...fallbackRest
        } = rest
        const fallback = await supabase.from('incidents').update(fallbackRest).eq('id', inc.id)
        error = fallback.error
      }
      if (error) {
        console.error('INCIDENT UPDATE ERROR:', error.message)
        throw new Error(`Failed to update incident: ${error.message}`)
      }
    }
    for (const inc of removed) {
      const { error } = await supabase.from('incidents').update({ deleted_at: new Date().toISOString() }).eq('id', inc.id)
      if (error) {
        console.error('INCIDENT DELETE ERROR:', error.message)
        throw new Error(`Failed to delete incident: ${error.message}`)
      }
    }
    reloadI()
  }

  async function setStaffList(updater) {
    let firstError = null
    const next = typeof updater === 'function' ? updater(staffList) : updater
    const added = next.filter(s => !staffList.find(x => x.id === s.id))
    const removed = staffList.filter(s => !next.find(x => x.id === s.id))
    const changed = next.filter(s => {
      const old = staffList.find(x => x.id === s.id)
      return old && JSON.stringify(old) !== JSON.stringify(s)
    })
    for (const s of added) {
      const { id, ...rest } = toSnake(s)
      const { error } = await supabase.from('staff').insert({ id: s.id, ...rest })
      if (error) {
        console.error('STAFF INSERT ERROR:', error.message)
        if (!firstError) firstError = new Error(`Failed to add staff member: ${error.message}`)
      }
    }
    for (const s of removed) {
      const { error } = await supabase.from('staff').update({ deleted_at: new Date().toISOString() }).eq('id', s.id)
      if (error) {
        console.error('STAFF DELETE ERROR:', error.message)
        if (!firstError) firstError = new Error(`Failed to remove staff member: ${error.message}`)
      }
    }
    for (const s of changed) {
      const { id, ...rest } = toSnake(s)
      const { error } = await supabase.from('staff').update(rest).eq('id', s.id)
      if (error) {
        console.error('STAFF UPDATE ERROR:', error.message)
        if (!firstError) firstError = new Error(`Failed to update staff member: ${error.message}`)
      }
    }
    reloadS()

    if (firstError) {
      throw firstError
    }
  }

  async function setBehaviourLogs(updater) {
    const next = typeof updater === 'function' ? updater(behaviourLogs) : updater
    const added = next.filter(entry => !behaviourLogs.find(x => x.id === entry.id))
    const removed = behaviourLogs.filter(entry => !next.find(x => x.id === entry.id))
    const changed = next.filter(entry => {
      const old = behaviourLogs.find(x => x.id === entry.id)
      return old && JSON.stringify(old) !== JSON.stringify(entry)
    })

    for (const entry of added) {
      const { id, ...rest } = toSnake(entry)
      const { error } = await supabase.from('behaviour_logs').insert({ id: entry.id, ...rest })
      if (error) {
        console.error('BEHAVIOUR INSERT ERROR:', error.message)
        throw new Error(`Failed to save behaviour entry: ${error.message}`)
      }
    }

    for (const entry of changed) {
      const { id, ...rest } = toSnake(entry)
      const { error } = await supabase.from('behaviour_logs').update(rest).eq('id', entry.id)
      if (error) {
        console.error('BEHAVIOUR UPDATE ERROR:', error.message)
        throw new Error(`Failed to update behaviour entry: ${error.message}`)
      }
    }

    for (const entry of removed) {
      const { error } = await supabase.from('behaviour_logs').delete().eq('id', entry.id)
      if (error) {
        console.error('BEHAVIOUR DELETE ERROR:', error.message)
        throw new Error(`Failed to delete behaviour entry: ${error.message}`)
      }
    }

    reloadBL()
  }

  async function setTimetableEntries(updater) {
    const currentEmail = (currentUser?.email || '').toLowerCase()
    const isOwner = Boolean(OWNER_EMAIL && currentEmail === OWNER_EMAIL)
    if (!isOwner && !isAdminUser) {
      throw new Error('Only owner/admin accounts can edit timetable entries')
    }

    const next = typeof updater === 'function' ? updater(timetableEntries) : updater
    const added = next.filter(entry => !timetableEntries.find(x => x.id === entry.id))
    const removed = timetableEntries.filter(entry => !next.find(x => x.id === entry.id))
    const changed = next.filter(entry => {
      const old = timetableEntries.find(x => x.id === entry.id)
      return old && JSON.stringify(old) !== JSON.stringify(entry)
    })

    for (const entry of added) {
      const { id, ...rest } = toSnake(entry)
      const { error } = await supabase.from('daily_timetable_entries').insert({ id: entry.id, ...rest })
      if (error) {
        console.error('TIMETABLE INSERT ERROR:', error.message)
        throw new Error(`Failed to save timetable entry: ${error.message}`)
      }
    }

    for (const entry of changed) {
      const { id, ...rest } = toSnake(entry)
      const { error } = await supabase.from('daily_timetable_entries').update(rest).eq('id', entry.id)
      if (error) {
        console.error('TIMETABLE UPDATE ERROR:', error.message)
        throw new Error(`Failed to update timetable entry: ${error.message}`)
      }
    }

    for (const entry of removed) {
      const { error } = await supabase.from('daily_timetable_entries').delete().eq('id', entry.id)
      if (error) {
        console.error('TIMETABLE DELETE ERROR:', error.message)
        throw new Error(`Failed to delete timetable entry: ${error.message}`)
      }
    }

    reloadT()
  }

  async function setTimetableSpaces(updater) {
    const currentEmail = (currentUser?.email || '').toLowerCase()
    const isOwner = Boolean(OWNER_EMAIL && currentEmail === OWNER_EMAIL)
    if (!isOwner && !isAdminUser) {
      throw new Error('Only owner/admin accounts can edit timetable spaces')
    }

    const currentSpaces = timetableSpaces
    const next = typeof updater === 'function' ? updater(currentSpaces) : updater
    const added = next.filter(space => !currentSpaces.find(x => x.id === space.id))
    const removed = currentSpaces.filter(space => !next.find(x => x.id === space.id))
    const changed = next.filter(space => {
      const old = currentSpaces.find(x => x.id === space.id)
      return old && JSON.stringify(old) !== JSON.stringify(space)
    })

    for (const space of added) {
      const { id, ...rest } = toSnake(space)
      const { error } = await supabase.from('timetable_spaces').insert({ id: space.id, ...rest })
      if (error) {
        throw new Error(`Failed to save timetable space: ${error.message}`)
      }
    }

    for (const space of changed) {
      const { id, ...rest } = toSnake(space)
      const { error } = await supabase.from('timetable_spaces').update(rest).eq('id', space.id)
      if (error) {
        throw new Error(`Failed to update timetable space: ${error.message}`)
      }
    }

    for (const space of removed) {
      const { error } = await supabase.from('timetable_spaces').delete().eq('id', space.id)
      if (error) {
        throw new Error(`Failed to delete timetable space: ${error.message}`)
      }
    }

    reloadTS()
  }

  async function setStarAwards(updater) {
    const next = typeof updater === 'function' ? updater(starAwards) : updater
    const previousRows = rawStarAwards
    setRawStarAwardsState(next)

    const added = next.filter(award => !starAwards.find(existing => existing.id === award.id))
    const removed = starAwards.filter(award => !next.find(existing => existing.id === award.id))
    const changed = next.filter(award => {
      const old = starAwards.find(existing => existing.id === award.id)
      return old && JSON.stringify(old) !== JSON.stringify(award)
    })

    try {
      for (const award of added) {
        const { id, ...rest } = toSnake(award)
        const { error } = await supabase.from('star_of_day_awards').insert({ id: award.id, ...rest })
        if (error) throw error
      }

      for (const award of changed) {
        const { id, ...rest } = toSnake({ ...award, updatedAt: new Date().toISOString() })
        const { error } = await supabase.from('star_of_day_awards').update(rest).eq('id', award.id)
        if (error) throw error
      }

      for (const award of removed) {
        const { error } = await supabase.from('star_of_day_awards').delete().eq('id', award.id)
        if (error) throw error
      }

      reloadStar()
    } catch (error) {
      setRawStarAwardsState(previousRows)
      throw new Error(error.message || 'Unable to save Star of the Day changes')
    }
  }

  function clearSessionTimers() {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current)
      inactivityTimeoutRef.current = null
    }
    if (warningIntervalRef.current) {
      clearInterval(warningIntervalRef.current)
      warningIntervalRef.current = null
    }
  }

  function startInactivityTimer() {
    if (!authed) return
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current)
    inactivityTimeoutRef.current = setTimeout(() => {
      setWarningCountdown(SESSION_WARNING_SECONDS)
      setShowSessionWarning(true)
    }, INACTIVITY_TIMEOUT_MS)
  }

  function sanitizeAllowedTabs(tabIds) {
    const valid = (tabIds || []).filter(tab => ALL_TABS.includes(tab))
    if (!valid.includes('dashboard')) valid.unshift('dashboard')
    if (!valid.includes('signin')) valid.unshift('signin')
    if (!valid.includes('shared-info')) valid.unshift('shared-info')
    return [...new Set(valid)]
  }

  function canAccess(tabId) {
    if (tabId === 'participant') {
      return (
        allowedTabIds.includes('participants')
        || allowedTabIds.includes('incidents')
        || allowedTabIds.includes('medical')
        || allowedTabIds.includes('parents')
      )
    }
    return allowedTabIds.includes(tabId)
  }

  async function loadPermissionsForUser(user) {
    if (!user) {
      setIsAdminUser(false)
      setAllowedTabIds(BASIC_TABS)
      setCanViewTimetableOverview(false)
      setPermissionsLoading(false)
      return
    }

    const userEmail = (user.email || '').toLowerCase()
    if (OWNER_EMAIL && userEmail === OWNER_EMAIL) {
      setIsAdminUser(true)
      setAllowedTabIds(ALL_TABS)
      setCanViewTimetableOverview(true)
      setPermissionsLoading(false)
      return
    }

    try {
      let data = null
      let error = null

      const primary = await Promise.race([
        supabase
          .from('user_tab_permissions')
          .select('is_admin, allowed_tabs, can_view_timetable_overview')
          .eq('user_id', user.id)
          .maybeSingle(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('permissions load timed out')), 15000)
        }),
      ])

      data = primary.data
      error = primary.error

      if (error && isMissingColumnError(error, 'can_view_timetable_overview')) {
        const fallback = await supabase
          .from('user_tab_permissions')
          .select('is_admin, allowed_tabs')
          .eq('user_id', user.id)
          .maybeSingle()
        data = fallback.data
        error = fallback.error
      }

      if (error) {
        console.error('PERMISSIONS LOAD ERROR:', error.message)
        setIsAdminUser(false)
        setAllowedTabIds(BASIC_TABS)
        setCanViewTimetableOverview(false)
        setPermissionsLoading(false)
        return
      }

      if (data?.is_admin) {
        setIsAdminUser(true)
        setAllowedTabIds(ALL_TABS)
        setCanViewTimetableOverview(true)
        setPermissionsLoading(false)
        return
      }

      setIsAdminUser(false)
      setCanViewTimetableOverview(Boolean(data?.can_view_timetable_overview))
      setCanEditTimetable(Boolean(data?.can_edit_timetable))

      if (Array.isArray(data?.allowed_tabs) && data.allowed_tabs.length > 0) {
        setAllowedTabIds(sanitizeAllowedTabs(data.allowed_tabs))
      } else {
        setAllowedTabIds(BASIC_TABS)
      }
      setPermissionsLoading(false)
    } catch (error) {
      console.error('PERMISSIONS LOAD EXCEPTION:', error?.message || error)
      setIsAdminUser(false)
      setAllowedTabIds(BASIC_TABS)
      setCanViewTimetableOverview(false)
      setPermissionsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const { data, error } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('session check timed out')), SESSION_CHECK_TIMEOUT_MS)
          }),
        ])

        if (error) {
          console.error('AUTH SESSION ERROR:', error.message)
        }
        if (!mounted) return
        const hasSession = !!data.session
        setAuthed(hasSession)
        setCurrentUser(data.session?.user || null)
        setAuthLoading(false)
        if (hasSession) {
          setPermissionsLoading(true)
          loadPermissionsForUser(data.session.user)
        } else {
          setPermissionsLoading(false)
          setAllowedTabIds(BASIC_TABS)
          setCanViewTimetableOverview(false)
        }
      } catch (error) {
        console.error('AUTH SESSION EXCEPTION:', error?.message || error)
        if (!mounted) return
        setAuthed(false)
        setCurrentUser(null)
        setIsAdminUser(false)
        setAllowedTabIds(BASIC_TABS)
        setCanViewTimetableOverview(false)
        setPermissionsLoading(false)
        setAuthLoading(false)
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const hasSession = !!session
        setAuthed(hasSession)
        setCurrentUser(session?.user || null)
        setPermissionsLoading(hasSession)
        if (hasSession) {
          loadPermissionsForUser(session.user)
        } else {
          setAllowedTabIds(BASIC_TABS)
          setCanViewTimetableOverview(false)
          setPermissionsLoading(false)
        }
      } catch (error) {
        console.error('AUTH STATE CHANGE EXCEPTION:', error?.message || error)
        setAuthed(false)
        setCurrentUser(null)
        setIsAdminUser(false)
        setAllowedTabIds(BASIC_TABS)
        setCanViewTimetableOverview(false)
        setPermissionsLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authLoading) {
      if (authWatchdogRef.current) clearTimeout(authWatchdogRef.current)
      return
    }

    if (authWatchdogRef.current) clearTimeout(authWatchdogRef.current)
    authWatchdogRef.current = setTimeout(() => {
      console.error('AUTH WATCHDOG: session check exceeded timeout, forcing recovery')
      setAuthed(false)
      setCurrentUser(null)
      setIsAdminUser(false)
      setAllowedTabIds(BASIC_TABS)
      setCanViewTimetableOverview(false)
      setPermissionsLoading(false)
      setAuthLoading(false)
    }, 20000)

    return () => {
      if (authWatchdogRef.current) clearTimeout(authWatchdogRef.current)
    }
  }, [authLoading])

  useEffect(() => {
    if (!permissionsLoading) {
      if (permissionsWatchdogRef.current) clearTimeout(permissionsWatchdogRef.current)
      return
    }

    if (permissionsWatchdogRef.current) clearTimeout(permissionsWatchdogRef.current)
    permissionsWatchdogRef.current = setTimeout(() => {
      console.error('PERMISSIONS WATCHDOG: permissions load exceeded timeout, defaulting to basic tabs')
      setIsAdminUser(false)
      setAllowedTabIds(BASIC_TABS)
      setCanViewTimetableOverview(false)
      setPermissionsLoading(false)
    }, 20000)

    return () => {
      if (permissionsWatchdogRef.current) clearTimeout(permissionsWatchdogRef.current)
    }
  }, [permissionsLoading])

  async function logout() {
    clearSessionTimers()
    await supabase.auth.signOut()
    routerNavigate(pathForPage('dashboard'), { replace: true })
    setCurrentUser(null)
    setIsAdminUser(false)
    setAllowedTabIds(BASIC_TABS)
    setCanViewTimetableOverview(false)
    setShowSessionWarning(false)
    setWarningCountdown(SESSION_WARNING_SECONDS)
  }

  function staySignedIn() {
    setShowSessionWarning(false)
    setWarningCountdown(SESSION_WARNING_SECONDS)
    startInactivityTimer()
  }

  const currentUserEmail = (currentUser?.email || '').toLowerCase()
  const isOwnerUser = Boolean(OWNER_EMAIL && currentUserEmail === OWNER_EMAIL)
  const currentStaff = staffList.find(staff => String(staff.email || '').toLowerCase() === currentUserEmail) || null
  const actorFullName = currentStaff?.name || (isOwnerUser ? 'Sam Brenner' : '')
  const actorFirstName = firstNameFromName(actorFullName)
  const actorInitials = initialsFromName(actorFullName || currentUserEmail || 'Staff')
  const canViewSafeguarding = Boolean(
    isOwnerUser
      || isAdminUser
      || ['camp coordinator', 'director'].includes(
        String(staffList.find(staff => String(staff.email || '').toLowerCase() === currentUserEmail)?.role || '').trim().toLowerCase()
      )
  )

  const canViewSendDiagnosis = Boolean(
    isOwnerUser
      || isAdminUser
      || allowedTabIds.includes('medical')
  )
  const requiresPasswordChange = Boolean(currentUser?.user_metadata?.must_change_password)

  async function submitForcedPasswordChange(e) {
    e.preventDefault()
    setForcePasswordError('')

    if (forcePassword.length < 8) {
      setForcePasswordError('Password must be at least 8 characters.')
      return
    }

    if (forcePassword !== forcePasswordConfirm) {
      setForcePasswordError('Passwords do not match.')
      return
    }

    setForcePasswordSaving(true)
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: forcePassword,
        data: {
          ...(currentUser?.user_metadata || {}),
          must_change_password: false,
        },
      })
      if (error) throw error

      setCurrentUser(data?.user || currentUser)
      setForcePassword('')
      setForcePasswordConfirm('')
    } catch (error) {
      setForcePasswordError(error.message || 'Unable to update password')
    } finally {
      setForcePasswordSaving(false)
    }
  }

  useEffect(() => {
    if (!authed) {
      clearSessionTimers()
      setShowSessionWarning(false)
      return
    }

    function handleActivity() {
      if (showSessionWarning) return
      startInactivityTimer()
    }

    startInactivityTimer()

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('click', handleActivity)
    window.addEventListener('scroll', handleActivity)
    window.addEventListener('touchstart', handleActivity)

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
    }
  }, [authed, showSessionWarning])

  useEffect(() => {
    if (!authed || !showSessionWarning) {
      if (warningIntervalRef.current) {
        clearInterval(warningIntervalRef.current)
        warningIntervalRef.current = null
      }
      return
    }

    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current)
    warningIntervalRef.current = setInterval(() => {
      setWarningCountdown(prev => {
        if (prev <= 1) {
          if (warningIntervalRef.current) {
            clearInterval(warningIntervalRef.current)
            warningIntervalRef.current = null
          }
          logout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (warningIntervalRef.current) {
        clearInterval(warningIntervalRef.current)
        warningIntervalRef.current = null
      }
    }
  }, [authed, showSessionWarning])

  useEffect(() => {
    if (!authed || permissionsLoading) return
    if (!routeState.isKnownRoute) {
      routerNavigate(pathForPage('dashboard'), { replace: true })
      return
    }
    if (canAccess(page)) return
    const fallback = allowedTabIds[0] || 'dashboard'
    routerNavigate(pathForPage(fallback), { replace: true })
  }, [authed, permissionsLoading, page, allowedTabIds, routeState.isKnownRoute, routerNavigate])

  useEffect(() => {
    if (!authed || permissionsLoading) return

    const likelyTabs = ['dashboard', 'signin', 'participants', 'incidents', 'attendance', 'star-of-day', 'medical', 'documents']
      .filter(tab => allowedTabIds.includes(tab) && tab !== page)
      .slice(0, 4)

    for (const tab of likelyTabs) {
      if (prefetchedRoutesRef.current.has(tab)) continue
      prefetchedRoutesRef.current.add(tab)
      ROUTE_PREFETCHERS[tab]?.()
    }

    if (allowedTabIds.includes('participants') && !prefetchedRoutesRef.current.has('participant')) {
      prefetchedRoutesRef.current.add('participant')
      ROUTE_PREFETCHERS.participant?.()
    }
  }, [authed, permissionsLoading, allowedTabIds, page])

  useEffect(() => {
    const canSeeWarnings = authed && !permissionsLoading && (isAdminUser || isOwnerUser)

    if (!canSeeWarnings) {
      setSchemaWarnings([])
      return
    }

    let active = true
    let idleId = null

    async function checkSchemaFallbacks() {
      const warnings = []

      const checks = [
        {
          key: 'attendance_sign_actor_columns',
          table: 'attendance',
          columns: 'id,sign_in_by,sign_out_by',
          label: 'Attendance action initials columns are missing (sign_in_by/sign_out_by).',
        },
        {
          key: 'incidents_action_initials',
          table: 'incidents',
          columns: 'id,created_by_initials,updated_by_initials',
          label: 'Incident action initials columns are missing (created_by_initials/updated_by_initials).',
        },
        {
          key: 'documents_upload_initials',
          table: 'documents',
          columns: 'id,uploaded_by_initials',
          label: 'Document uploader initials column is missing (uploaded_by_initials).',
        },
        {
          key: 'participants_seasonal_assignment',
          table: 'participants',
          columns: 'id,is_active_this_season',
          label: 'Seasonal participant toggle column is missing (is_active_this_season). Run db/23_seasonal_signin_assignments.sql.',
        },
        {
          key: 'staff_seasonal_assignment',
          table: 'staff',
          columns: 'id,is_assigned_this_season',
          label: 'Seasonal staff toggle column is missing (is_assigned_this_season). Run db/23_seasonal_signin_assignments.sql.',
        },
        {
          key: 'star_of_day_table',
          table: 'star_of_day_awards',
          columns: 'id,participant_id,award_date',
          label: 'Star of the Day table is missing (star_of_day_awards). Run db/27_star_of_the_day.sql.',
        },
      ]

      for (const check of checks) {
        const { error } = await supabase.from(check.table).select(check.columns).limit(1)
        if (error && error.message && error.message.toLowerCase().includes('does not exist')) {
          warnings.push({ key: check.key, label: check.label })
        }
      }

      if (!active) return
      setSchemaWarnings(warnings)
    }

    const runCheck = () => {
      checkSchemaFallbacks().catch(error => {
        console.error('SCHEMA WARNING CHECK ERROR:', error?.message || error)
      })
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(runCheck, { timeout: 5000 })
    } else {
      idleId = setTimeout(runCheck, 1500)
    }

    return () => {
      active = false
      if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function' && typeof idleId === 'number') {
        window.cancelIdleCallback(idleId)
      } else if (idleId) {
        clearTimeout(idleId)
      }
    }
  }, [authed, permissionsLoading, isAdminUser, currentUserEmail])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-display font-medium">Checking session...</p>
        </div>
      </div>
    )
  }

  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-display font-medium">Loading permissions...</p>
        </div>
      </div>
    )
  }

  if (!authed) {
    return <Login />
  }

  if (requiresPasswordChange) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-stone-200 shadow-xl p-6 space-y-4">
          <div>
            <h2 className="font-display font-bold text-forest-950 text-xl">Set Your New Password</h2>
            <p className="text-sm text-stone-600 mt-1">An admin reset your account password. You must set your own password before continuing.</p>
          </div>
          <form onSubmit={submitForcedPasswordChange} className="space-y-3">
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                className="input"
                minLength={8}
                value={forcePassword}
                onChange={e => setForcePassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input
                type="password"
                className="input"
                minLength={8}
                value={forcePasswordConfirm}
                onChange={e => setForcePasswordConfirm(e.target.value)}
                required
              />
            </div>
            {forcePasswordError && <p className="text-sm text-red-700">{forcePasswordError}</p>}
            <button type="submit" className="btn-primary w-full" disabled={forcePasswordSaving}>
              {forcePasswordSaving ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const shouldBlockForData = loading && !['dashboard', 'signin', 'shared-info'].includes(page)

  if (shouldBlockForData) {
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-display font-medium">Loading database...</p>
        </div>
      </div>
    )
  }

  function navigate(p, id = null) {
    const destination = canAccess(p) ? p : (allowedTabIds[0] || 'dashboard')
    const targetPath = destination === 'participant' && id !== null
      ? pathForPage('participant', id)
      : pathForPage(destination)
    routerNavigate(targetPath)
  }

  function renderPage() {
    if (!canAccess(page)) {
      return (
        <div className="card text-center py-10">
          <p className="text-stone-600 font-medium">You do not have permission to view this section.</p>
          <p className="text-stone-400 text-sm mt-1">Contact an admin to request access.</p>
        </div>
      )
    }
    switch (page) {
      case 'dashboard': return (
        <Dashboard
          participants={participants}
          attendance={attendance}
          incidents={incidents}
          greetingName={actorFirstName}
          onNavigate={navigate}
          allowedTabs={allowedTabIds}
          canManageUserResets={isOwnerUser || isAdminUser}
        />
      )
      case 'signin': return <SignInOut participants={participants} attendance={attendance} setAttendance={setAttendance} actorInitials={actorInitials} incidents={incidents} setIncidents={setIncidents} canViewAdminFollowUps={isOwnerUser || isAdminUser} />
      case 'shared-info': return <SharedInfo currentUser={currentUser} participants={participants} />
      case 'attendance': return <AttendanceOverview participants={participants} attendance={attendance} setAttendance={setAttendance} />
      case 'star-of-day': return <StarOfTheDay participants={participants} starAwards={starAwards} setStarAwards={setStarAwards} />
      case 'participants': return <Participants participants={participants} setParticipants={setParticipants} onView={(id) => navigate('participant', id)} />
      case 'parents': return <Parents participants={participants} onUpdateParticipant={(id, approvedAdults) => {
        setParticipants(prev => prev.map(p => p.id === id ? { ...p, approvedAdults } : p))
      }} />
      case 'dressing-rooms': return <DressingRooms participants={participants} />
      case 'documents': return <Documents canViewSafeguarding={canViewSafeguarding} isOwnerUser={isOwnerUser} actorInitials={actorInitials} />
      case 'participant': return (
        <ParticipantDetail
          participant={participants.find(p => p.id === selectedParticipantId)}
          participants={participants}
          setParticipants={setParticipants}
          attendance={attendance}
          incidents={incidents}
          setIncidents={setIncidents}
          staffList={staffList}
          actorInitials={actorInitials}
          actorUserId={currentUser?.id || ''}
          currentStaffName={actorFullName || currentUserEmail}
          canViewSafeguarding={canViewSafeguarding}
          canViewSendDiagnosis={canViewSendDiagnosis}
          canManageShares={isOwnerUser || isAdminUser}
          onBack={() => navigate('participants')}
        />
      )
      case 'medical': return <Medical participants={participants} setParticipants={setParticipants} actorInitials={actorInitials} onView={(id) => navigate('participant', id)} />
      case 'behaviour': return <BehaviourLogs participants={participants} incidents={incidents} behaviourLogs={behaviourLogs} setBehaviourLogs={setBehaviourLogs} actorInitials={actorInitials} />
      case 'timetable': return (
        <Timetable
          timetableEntries={timetableEntries}
          setTimetableEntries={setTimetableEntries}
          timetableSpaces={timetableSpaces}
          setTimetableSpaces={setTimetableSpaces}
          actorInitials={actorInitials}
          staffList={staffList}
          currentUserEmail={currentUserEmail}
          currentUserName={actorFullName}
          isOwnerUser={isOwnerUser}
          isAdminUser={isAdminUser}
          canViewTimetableOverview={canViewTimetableOverview}
          canEditTimetable={canEditTimetable}
        />
      )
      case 'incidents': return <Incidents incidents={incidents} setIncidents={setIncidents} participants={participants} setParticipants={setParticipants} staffList={staffList} actorInitials={actorInitials} actorUserId={currentUser?.id || ''} currentStaffName={actorFullName || currentUserEmail} canViewSafeguarding={canViewSafeguarding} canViewParticipant={isOwnerUser || isAdminUser} onView={(id) => navigate('participant', id)} />
      case 'staff': return <Staff staffList={staffList} setStaffList={setStaffList} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      <Nav page={page} onNavigate={navigate} onLogout={logout} visibleTabIds={allowedTabIds} />
      <main className="pt-14 md:pt-0 md:ml-56">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {attendanceError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm text-rose-800 font-medium">{attendanceError}</p>
            </div>
          )}
          {schemaWarnings.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-900 font-semibold">Schema warnings detected</p>
              <p className="text-xs text-amber-800 mt-1">Some migrations appear missing. Fallback mode is active and certain metadata may not be saved.</p>
              <ul className="mt-2 text-xs text-amber-800 list-disc list-inside space-y-1">
                {schemaWarnings.map(item => (
                  <li key={item.key}>{item.label}</li>
                ))}
              </ul>
            </div>
          )}
          <Suspense fallback={<div className="card text-center py-10"><p className="text-stone-600 font-medium">Loading section...</p></div>}>
            {renderPage()}
          </Suspense>
        </div>
      </main>
      {showSessionWarning && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-stone-200 shadow-xl p-5">
            <h3 className="font-display font-semibold text-forest-950 text-lg">Stay signed in?</h3>
            <p className="text-sm text-stone-600 mt-2">
              You have been inactive. You will be signed out in <span className="font-semibold text-rose-700">{warningCountdown}s</span>.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button onClick={staySignedIn} className="btn-primary flex-1">Yes, stay signed in</button>
              <button onClick={logout} className="btn-secondary">Sign out now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}