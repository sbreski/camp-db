import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import ParticipantNameText from './ParticipantNameText'

const RATING_OPTIONS = [
  { value: 'P', label: 'P (Positive)' },
  { value: 'N', label: 'N (Negative)' },
  { value: '-', label: '- (Neutral / Information)' },
]

const SEVERITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function BehaviourLogs({
  participants = [],
  behaviourLogs = [],
  setBehaviourLogs,
  actorInitials = 'ST',
}) {
  const [showForm, setShowForm] = useState(false)
  const [participantFilter, setParticipantFilter] = useState('')
  const [participantScope, setParticipantScope] = useState('active')
  const [viewMode, setViewMode] = useState('detailed')
  const [form, setForm] = useState({
    participantId: '',
    overview: '',
    rating: '-',
    severity: 'medium',
    followUpRequired: false,
  })

  const visibleLogs = useMemo(() => {
    const activeParticipantIds = new Set(
      participants
        .filter(p => (p.isActiveThisSeason ?? p.is_active_this_season) !== false)
        .map(p => p.id)
    )

    return [...behaviourLogs]
      .filter(log => {
        const participantId = log.participantId || log.participant_id
        if (participantScope === 'active' && !activeParticipantIds.has(participantId)) return false
        return participantFilter ? participantId === participantFilter : true
      })
      .sort((a, b) => new Date(b.loggedAt || b.logged_at || b.createdAt || b.created_at) - new Date(a.loggedAt || a.logged_at || a.createdAt || a.created_at))
  }, [behaviourLogs, participantFilter, participantScope, participants])

  const participantOptions = useMemo(() => {
    const inScope = participants.filter(p => {
      if (participantScope === 'all') return true
      return (p.isActiveThisSeason ?? p.is_active_this_season) !== false
    })
    return [...inScope].sort((a, b) => a.name.localeCompare(b.name))
  }, [participants, participantScope])

  const groupedByParticipant = useMemo(() => {
    const grouped = new Map()
    for (const entry of visibleLogs) {
      const pid = entry.participantId || entry.participant_id || ''
      if (!grouped.has(pid)) grouped.set(pid, [])
      grouped.get(pid).push(entry)
    }
    return [...grouped.entries()]
      .map(([participantId, entries]) => ({ participantId, entries }))
      .sort((a, b) => participantName(a.participantId).localeCompare(participantName(b.participantId)))
  }, [visibleLogs, participants])

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (!showForm) return

    function onShortcutKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target
      const tag = (target?.tagName || '').toLowerCase()
      const isTypingField = tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target?.isContentEditable)
      if (isTypingField) return

      const key = e.key.toLowerCase()
      if (key === 'p') {
        e.preventDefault()
        setForm(prev => ({ ...prev, rating: 'P' }))
        return
      }
      if (key === 'n') {
        e.preventDefault()
        setForm(prev => ({ ...prev, rating: 'N' }))
        return
      }
      if (e.key === '-') {
        e.preventDefault()
        setForm(prev => ({ ...prev, rating: '-' }))
        return
      }

      if (key === '1') {
        e.preventDefault()
        setForm(prev => ({ ...prev, rating: 'N', severity: 'low' }))
        return
      }
      if (key === '2') {
        e.preventDefault()
        setForm(prev => ({ ...prev, rating: 'N', severity: 'medium' }))
        return
      }
      if (key === '3') {
        e.preventDefault()
        setForm(prev => ({ ...prev, rating: 'N', severity: 'high' }))
      }
    }

    window.addEventListener('keydown', onShortcutKey)
    return () => window.removeEventListener('keydown', onShortcutKey)
  }, [showForm])

  useEffect(() => {
    if (!participantFilter) return
    const stillVisible = participantOptions.some(p => p.id === participantFilter)
    if (!stillVisible) setParticipantFilter('')
  }, [participantFilter, participantOptions])

  useEffect(() => {
    if (!form.participantId) return
    const stillVisible = participantOptions.some(p => p.id === form.participantId)
    if (!stillVisible) {
      setForm(prev => ({ ...prev, participantId: '' }))
    }
  }, [form.participantId, participantOptions])

  async function createEntry(e) {
    e.preventDefault()
    if (!form.participantId || !form.overview.trim()) {
      alert('Please choose a participant and add an overview.')
      return
    }
    if (form.rating === 'N' && !form.severity) {
      alert('Please choose a severity for negative entries.')
      return
    }

    try {
      await setBehaviourLogs(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          participantId: form.participantId,
          loggedAt: new Date().toISOString(),
          overview: form.overview.trim(),
          rating: form.rating,
          category: form.rating,
          severity: form.rating === 'N' ? form.severity : 'low',
          followUpRequired: form.followUpRequired,
          outcome: form.overview.trim(),
          staffInitials: actorInitials,
        },
      ])

      setForm({
        participantId: '',
        overview: '',
        rating: '-',
        severity: 'medium',
        followUpRequired: false,
      })
      setShowForm(false)
    } catch (error) {
      alert(error.message || 'Failed to save behaviour entry')
    }
  }

  async function removeEntry(entry) {
    if (!window.confirm('Delete this behaviour entry?')) return
    try {
      await setBehaviourLogs(prev => prev.filter(log => log.id !== entry.id))
    } catch (error) {
      alert(error.message || 'Failed to delete behaviour entry')
    }
  }

  function participantName(id) {
    return participants.find(p => p.id === id)?.name || 'Unknown participant'
  }

  function toneFromEntry(entry) {
    const rating = entry.rating || entry.category || '-'
    const severity = String(entry.severity || 'medium').toLowerCase()

    if (rating === 'P') {
      return {
        label: 'Positive',
        short: 'P',
        card: 'border-green-200 bg-green-50/40',
        pill: 'bg-green-100 text-green-800 border-green-300',
        dot: 'bg-green-500',
      }
    }

    if (rating === '-') {
      return {
        label: 'Neutral',
        short: '-',
        card: 'border-stone-200 bg-stone-50/60',
        pill: 'bg-stone-100 text-stone-700 border-stone-300',
        dot: 'bg-stone-400',
      }
    }

    if (severity === 'high') {
      return {
        label: 'Negative High',
        short: 'N-H',
        card: 'border-red-200 bg-red-50/40',
        pill: 'bg-red-100 text-red-800 border-red-300',
        dot: 'bg-red-500',
      }
    }

    if (severity === 'medium') {
      return {
        label: 'Negative Medium',
        short: 'N-M',
        card: 'border-orange-200 bg-orange-50/40',
        pill: 'bg-orange-100 text-orange-800 border-orange-300',
        dot: 'bg-orange-500',
      }
    }

    return {
      label: 'Negative Low',
      short: 'N-L',
      card: 'border-yellow-200 bg-yellow-50/40',
      pill: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      dot: 'bg-yellow-500',
    }
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Behaviour Log</h2>
          <p className="text-stone-500 text-sm">Track behaviour notes and interventions.</p>
        </div>
        <button onClick={() => setShowForm(prev => !prev)} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
          <Plus size={15} /> {showForm ? 'Close Form' : 'New Entry'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createEntry} className="card border-2 border-forest-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Participant *</label>
              <select className="input" value={form.participantId} onChange={e => setField('participantId', e.target.value)} required>
                <option value="">Select participant...</option>
                {participantOptions.map(participant => (
                  <option key={participant.id} value={participant.id}>{participant.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Rating *</label>
              <p className="text-xs text-stone-500 mb-1">Keyboard: P = Positive, N = Negative, - = Neutral</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {RATING_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setField('rating', option.value)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${form.rating === option.value ? 'border-forest-700 bg-forest-50 text-forest-900 font-semibold' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {form.rating === 'N' && (
              <div>
                <label className="label">Severity *</label>
                <p className="text-xs text-stone-500 mb-1">Keyboard: 1 = Low, 2 = Medium, 3 = High</p>
                <div className="grid grid-cols-3 gap-2">
                  {SEVERITY_OPTIONS.map(option => {
                    const selected = form.severity === option.value
                    const tone = option.value === 'high'
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : option.value === 'medium'
                        ? 'border-orange-300 bg-orange-50 text-orange-800'
                        : 'border-yellow-300 bg-yellow-50 text-yellow-800'
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setField('severity', option.value)}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${selected ? `${tone} font-semibold` : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label">Overview *</label>
              <textarea className="input resize-none" rows={4} value={form.overview} onChange={e => setField('overview', e.target.value)} placeholder="Overview of why this log is being made" required />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.followUpRequired}
                  onChange={e => setField('followUpRequired', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-forest-900 cursor-pointer"
                />
                <span className="text-sm text-stone-700">Mark for register follow up</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Save Entry</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="label">Participant Scope</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setParticipantScope('active')}
                className={`rounded-lg border px-3 py-2 text-sm text-left transition ${participantScope === 'active' ? 'border-forest-700 bg-forest-50 text-forest-900 font-semibold' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}`}
              >
                Active Participants
              </button>
              <button
                type="button"
                onClick={() => setParticipantScope('all')}
                className={`rounded-lg border px-3 py-2 text-sm text-left transition ${participantScope === 'all' ? 'border-forest-700 bg-forest-50 text-forest-900 font-semibold' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}`}
              >
                All Participants
              </button>
            </div>
          </div>
          <div>
            <label className="label">Filter by participant</label>
            <select className="input" value={participantFilter} onChange={e => setParticipantFilter(e.target.value)}>
              <option value="">All participants</option>
              {participantOptions.map(participant => (
                <option key={participant.id} value={participant.id}>{participant.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">View Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setViewMode('detailed')}
                className={`rounded-lg border px-3 py-2 text-sm text-left transition ${viewMode === 'detailed' ? 'border-forest-700 bg-forest-50 text-forest-900 font-semibold' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}`}
              >
                Detailed Entries
              </button>
              <button
                type="button"
                onClick={() => setViewMode('participant')}
                className={`rounded-lg border px-3 py-2 text-sm text-left transition ${viewMode === 'participant' ? 'border-forest-700 bg-forest-50 text-forest-900 font-semibold' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'}`}
              >
                Participant Colour Strip
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'participant' && visibleLogs.length > 0 && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-700">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Positive</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-stone-400" /> Neutral</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Negative Low</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Negative Medium</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Negative High</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visibleLogs.length === 0 ? (
          <div className="card text-center py-10">
            <AlertTriangle size={28} className="mx-auto mb-2 text-stone-300" />
            <p className="text-stone-500 text-sm">No behaviour entries yet.</p>
          </div>
        ) : viewMode === 'participant' ? groupedByParticipant.map(group => {
          return (
            <div key={group.participantId || 'unknown'} className="card border border-stone-200">
              <div className="flex items-center justify-between gap-2">
                <ParticipantNameText participant={{ name: participantName(group.participantId) }} className="font-display font-semibold text-forest-950" />
                <span className="text-xs text-stone-500">{group.entries.length} log{group.entries.length === 1 ? '' : 's'}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.entries.map(entry => {
                  const tone = toneFromEntry(entry)
                  const ts = entry.loggedAt || entry.logged_at || entry.createdAt || entry.created_at
                  return (
                    <span
                      key={entry.id}
                      title={`${tone.label}${ts ? ` · ${formatDateTime(ts)}` : ''}`}
                      className={`h-3.5 w-3.5 rounded-full ${tone.dot}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        }) : visibleLogs.map(entry => {
          const tone = toneFromEntry(entry)
          const rating = entry.rating || entry.category || '-'
          return (
            <div key={entry.id} className={`card border ${tone.card}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <ParticipantNameText participant={{ name: participantName(entry.participantId) }} className="font-display font-semibold text-forest-950" />
                  <p className="text-xs text-stone-500 mt-0.5">{formatDateTime(entry.loggedAt || entry.logged_at)} · by {entry.staffInitials || entry.staff_initials || 'ST'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => removeEntry(entry)} className="p-1.5 text-stone-400 hover:text-red-600" title="Delete entry">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm text-stone-700">
                <p>
                  <span className="font-semibold text-stone-900">Type:</span>{' '}
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone.pill}`}>{tone.label}</span>
                </p>
                {rating === 'N' && (
                  <p><span className="font-semibold text-stone-900">Severity:</span> {entry.severity ? `${entry.severity.charAt(0).toUpperCase()}${entry.severity.slice(1)}` : 'Medium'}</p>
                )}
                <p><span className="font-semibold text-stone-900">Overview:</span> {entry.overview || entry.outcome || entry.triggerText || entry.actionTaken || '—'}</p>
                {(entry.followUpRequired || entry.follow_up_required) && <p><span className="font-semibold text-stone-900">Register Follow Up:</span> Yes</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
