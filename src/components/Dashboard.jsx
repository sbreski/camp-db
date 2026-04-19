import { useEffect, useState } from 'react'
import { Users, LogIn, LogOut, AlertTriangle, Clock, Stethoscope, RefreshCw } from 'lucide-react'
import ParticipantNameText from './ParticipantNameText'
import { getFollowUpsDue } from '../utils/workflow'
import { supabase } from '../supabase'

function isMissingTableError(error, tableName) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes(String(tableName || '').toLowerCase()) && message.includes('does not exist')
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard({
  participants,
  attendance,
  incidents,
  greetingName = '',
  onNavigate,
  allowedTabs = [],
  canManageUserResets = false,
}) {
  const today = todayKey()
  const todayAttendance = attendance.filter(a => a.date === today)
  const signedInIds = new Set(todayAttendance.filter(a => a.signIn && !a.signOut).map(a => a.participantId))
  const signedOutToday = todayAttendance.filter(a => a.signOut).length
  const medicalCount = participants.filter(p => p.medicalType && p.medicalType.length > 0).length
  const safeguardingCount = participants.filter(p => p.safeguardingFlag).length
  const recentIncidents = incidents.slice(-3).reverse()
  const followUpsDue = getFollowUpsDue(incidents, participants, today)
  const noteFollowUps = canManageUserResets
    ? todayAttendance
      .filter(row => String(row.exceptionNotes || row.exception_notes || '').trim())
      .map(row => ({
        id: row.id,
        participant: participants.find(p => p.id === row.participantId) || null,
        note: String(row.exceptionNotes || row.exception_notes || '').trim(),
      }))
    : []
  const [resetRequests, setResetRequests] = useState([])
  const [resetRequestsLoading, setResetRequestsLoading] = useState(false)
  const [resetRequestsError, setResetRequestsError] = useState('')
  const [notices, setNotices] = useState([])
  const [noticesLoading, setNoticesLoading] = useState(false)
  const [noticesError, setNoticesError] = useState('')
  const [noticeDraft, setNoticeDraft] = useState('')
  const [noticeSaving, setNoticeSaving] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState('')
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const canAccess = tabId => Array.isArray(allowedTabs) && allowedTabs.includes(tabId)

  async function loadResetRequests() {
    if (!canManageUserResets) return
    setResetRequestsLoading(true)
    setResetRequestsError('')

    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      const accessToken = data?.session?.access_token
      if (!accessToken) throw new Error('No active session found')

      const response = await fetch('/api/admin-users', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load reset requests')

      setResetRequests(Array.isArray(payload.resetRequests) ? payload.resetRequests : [])
    } catch (error) {
      setResetRequestsError(error.message || 'Unable to load reset requests')
      setResetRequests([])
    } finally {
      setResetRequestsLoading(false)
    }
  }

  async function loadNotices() {
    setNoticesLoading(true)
    setNoticesError('')
    try {
      const { data, error } = await supabase
        .from('dashboard_notices')
        .select('id, message, updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      if (error) {
        if (isMissingTableError(error, 'dashboard_notices')) {
          setNotices([])
          return
        }
        throw error
      }

      const rows = Array.isArray(data) ? data : []
      setNotices(rows)
      if (canManageUserResets && !noticeDraft && rows.length > 0) {
        setNoticeDraft(rows[0].message || '')
      }
    } catch (error) {
      setNoticesError(error.message || 'Unable to load notices')
      setNotices([])
    } finally {
      setNoticesLoading(false)
    }
  }

  async function saveNotice() {
    const message = String(noticeDraft || '').trim()
    if (!message) {
      setNoticeMessage('Enter a notice message first.')
      return
    }

    setNoticeSaving(true)
    setNoticeMessage('')
    setNoticesError('')
    try {
      const currentNotice = notices[0] || null
      if (currentNotice?.id) {
        const { error } = await supabase
          .from('dashboard_notices')
          .update({ message, updated_at: new Date().toISOString() })
          .eq('id', currentNotice.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('dashboard_notices')
          .insert({ message, is_active: true })
        if (error) throw error
      }

      setNoticeMessage('Notice updated.')
      await loadNotices()
    } catch (error) {
      setNoticesError(error.message || 'Unable to save notice')
    } finally {
      setNoticeSaving(false)
    }
  }

  useEffect(() => {
    if (!canManageUserResets) return
    loadResetRequests()
  }, [canManageUserResets])

  useEffect(() => {
    loadNotices()
  }, [])

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div>
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">{greeting}{greetingName ? `, ${greetingName}` : ''}! 👋</h2>
          <p className="text-stone-500 text-sm mt-0.5">
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: 'Total Participants',
            value: participants.length,
            icon: Users,
            color: 'bg-forest-900 text-white',
            onClick: () => onNavigate('participants'),
            visible: canAccess('participants'),
          },
          {
            label: 'Signed In Now',
            value: signedInIds.size,
            icon: LogIn,
            color: 'bg-amber-500 text-forest-950',
            onClick: () => onNavigate('signin'),
            visible: canAccess('signin'),
          },
          {
            label: 'Signed Out Today',
            value: signedOutToday,
            icon: LogOut,
            color: 'bg-blue-600 text-white',
            onClick: () => onNavigate('signin'),
            visible: canAccess('signin'),
          },
          {
            label: 'Medical Flags',
            value: medicalCount,
            icon: Stethoscope,
            color: 'bg-red-600 text-white',
            onClick: () => onNavigate('medical'),
            visible: canAccess('medical'),
          },
          {
            label: 'Safeguarding Flags',
            value: safeguardingCount,
            icon: AlertTriangle,
            color: 'bg-rose-700 text-white',
            onClick: () => onNavigate('participants'),
            visible: canAccess('participants'),
          },
        ].filter(card => card.visible).map(({ label, value, icon: Icon, color, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="card hover:shadow-md transition-shadow text-left group"
          >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
              <Icon size={18} strokeWidth={2.5} />
            </div>
            <p className="text-2xl font-display font-bold text-forest-950">{value}</p>
            <p className="text-xs text-stone-500 font-body mt-0.5">{label}</p>
          </button>
        ))}
      </div>


      {canAccess('signin') && (
        <div className="card">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div>
              <h3 className="font-display font-semibold text-forest-950">Follow Ups Due</h3>
              <p className="text-xs text-stone-500">Items needing follow up today.</p>
            </div>
            <button
              type="button"
              className="btn-secondary text-xs flex items-center gap-1.5"
              onClick={() => onNavigate('signin')}
            >
              Open register →
            </button>
          </div>

          {followUpsDue.length === 0 ? (
            <p className="text-sm text-stone-500">No open follow ups due today.</p>
          ) : (
            <div className="space-y-2">
              {followUpsDue.slice(0, 6).map(inc => (
                <div key={inc.id} className="rounded-xl border border-stone-200 px-3 py-2">
                  <p className="text-sm font-medium text-forest-900">{inc.participant ? inc.participant.name : 'Unknown participant'}</p>
                  <p className="text-xs text-stone-500">{inc.type}</p>
                  <p className={`text-xs mt-1 font-semibold ${inc.status === 'overdue' ? 'text-red-700' : 'text-amber-700'}`}>
                    {inc.status === 'overdue' ? 'Overdue' : 'Due today'} · {new Date((inc.dueDate || today) + 'T12:00:00').toLocaleDateString('en-GB')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {canManageUserResets && noteFollowUps.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
              <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Sign In/Out Notes</p>
              {noteFollowUps.slice(0, 6).map(item => (
                <div key={item.id} className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2">
                  <p className="text-sm font-medium text-indigo-900">{item.participant ? item.participant.name : 'Unknown participant'}</p>
                  <p className="text-xs text-indigo-800 mt-0.5 whitespace-pre-wrap">{item.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="card">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div>
            <h3 className="font-display font-semibold text-forest-950">Notices</h3>
            <p className="text-xs text-stone-500">Important updates for all staff.</p>
          </div>
          <button
            type="button"
            className="btn-secondary text-xs flex items-center gap-1.5"
            onClick={loadNotices}
            disabled={noticesLoading}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {noticesError && <p className="text-xs text-red-700 mb-2">{noticesError}</p>}

        {noticesLoading ? (
          <p className="text-sm text-stone-500">Loading notices...</p>
        ) : notices.length === 0 ? (
          <p className="text-sm text-stone-500">No notices currently.</p>
        ) : (
          <div className="space-y-2">
            {notices.slice(0, 3).map(notice => (
              <div key={notice.id} className="rounded-xl border border-stone-200 px-3 py-2 bg-amber-50/40">
                <p className="text-sm text-stone-800 whitespace-pre-wrap">{notice.message}</p>
                <p className="text-[11px] text-stone-400 mt-1">Updated {new Date(notice.updated_at).toLocaleString('en-GB')}</p>
              </div>
            ))}
          </div>
        )}

        {canManageUserResets && (
          <div className="mt-4 pt-4 border-t border-stone-100 space-y-2">
            <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Admin Edit</p>
            <textarea
              className="input min-h-[96px]"
              value={noticeDraft}
              onChange={e => setNoticeDraft(e.target.value)}
              placeholder="Write an important notice for all staff..."
            />
            <div className="flex items-center gap-2">
              <button type="button" className="btn-primary text-sm" onClick={saveNotice} disabled={noticeSaving}>
                {noticeSaving ? 'Saving...' : 'Save Notice'}
              </button>
              {noticeMessage && <p className="text-xs text-emerald-700">{noticeMessage}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Today's attendance */}
      {(canAccess('signin') || canAccess('incidents')) && (
        <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-forest-950">Currently On Site</h3>
            {canAccess('signin') && (
              <button onClick={() => onNavigate('signin')} className="text-xs text-forest-600 hover:underline font-medium">
                Manage →
              </button>
            )}
          </div>
          {signedInIds.size === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">Nobody signed in yet today</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {participants.filter(p => signedInIds.has(p.id)).map(p => {
                const rec = todayAttendance.find(a => a.participantId === p.id && !a.signOut)
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                    <div>
                      <ParticipantNameText participant={p} showDiagnosedHighlight={false} forceNoDiagnosedHighlight={true} className="text-sm font-medium text-forest-950" />
                      <p className="text-xs text-stone-400">{p.pronouns}{p.age ? ` · Age ${p.age}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500">
                      <Clock size={12} />
                      {fmt(rec?.signIn)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent incidents */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-forest-950">Recent Incidents</h3>
            {canAccess('incidents') && (
              <button onClick={() => onNavigate('incidents')} className="text-xs text-forest-600 hover:underline font-medium">
                View all →
              </button>
            )}
          </div>
          {recentIncidents.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-6">No incidents logged</p>
          ) : (
            <div className="space-y-3">
              {recentIncidents.map(inc => {
                const p = participants.find(x => x.id === inc.participantId)
                return (
                  <div key={inc.id} className="flex items-start gap-3 py-2 border-b border-stone-50 last:border-0">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      inc.severity === 'high' ? 'bg-red-500' :
                      inc.severity === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                    }`} />
                    <div>
                      {p ? <ParticipantNameText participant={p} showDiagnosedHighlight={false} forceNoDiagnosedHighlight={true} className="text-sm font-medium text-forest-950" /> : <p className="text-sm font-medium text-forest-950">Unknown</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{inc.type || 'Other'}</span>
                        <span className="text-xs text-stone-400">{new Date(inc.createdAt).toLocaleDateString('en-GB')}</span>
                      </div>
                      <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">{inc.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {canManageUserResets && (
        <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-forest-950">Open Password Reset Requests</h3>
          <button onClick={loadResetRequests} className="text-xs text-forest-600 hover:underline font-medium" disabled={resetRequestsLoading}>
            Refresh →
          </button>
        </div>
        {resetRequestsError && <p className="text-xs text-red-700 mb-2">{resetRequestsError}</p>}
        {resetRequestsLoading ? (
          <p className="text-stone-400 text-sm text-center py-4">Loading reset requests...</p>
        ) : resetRequests.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-4">No open reset requests.</p>
        ) : (
          <div className="space-y-2">
            {resetRequests.slice(0, 8).map(request => (
              <div key={request.id} className="rounded-xl border border-stone-200 px-3 py-2">
                <p className="text-sm font-medium text-forest-900">{request.requester_email || 'Unknown email'}</p>
                {request.requester_identifier && (
                  <p className="text-xs text-stone-500">Identifier: {request.requester_identifier}</p>
                )}
                {request.reason && (
                  <p className="text-xs text-stone-700 mt-1 whitespace-pre-wrap">{request.reason}</p>
                )}
                <p className="text-[11px] text-stone-400 mt-1">
                  Requested {new Date(request.requested_at).toLocaleString('en-GB')}
                </p>
              </div>
            ))}
            <div className="pt-1">
              <button type="button" className="text-xs text-forest-700 hover:underline" onClick={() => onNavigate('staff')}>
                Open Staff tab to action resets →
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Quick actions */}
      <div className="card">
        <h3 className="font-display font-semibold text-forest-950 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          {canAccess('signin') && (
            <button onClick={() => onNavigate('signin')} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
              <LogIn size={15} /> Sign In / Out
            </button>
          )}
          {canAccess('participants') && (
            <button onClick={() => onNavigate('participants')} className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto">
              <Users size={15} /> Add Participant
            </button>
          )}
          {canAccess('incidents') && (
            <button onClick={() => onNavigate('incidents')} className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto">
              <AlertTriangle size={15} /> Log Incident
            </button>
          )}
          {canAccess('medical') && (
            <button onClick={() => onNavigate('medical')} className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto">
              <Stethoscope size={15} /> Medical View
            </button>
          )}
          {/* Timetable is always visible */}
          <button onClick={() => onNavigate('timetable')} className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto">
            <Clock size={15} /> Timetable
          </button>
        </div>
      </div>

    </div>
  )
}
