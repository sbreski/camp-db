import { useMemo, useState } from 'react'
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
  const [form, setForm] = useState({
    participantId: '',
    overview: '',
    rating: '-',
    severity: 'medium',
  })

  const visibleLogs = useMemo(() => {
    return [...behaviourLogs]
      .filter(log => (participantFilter ? log.participantId === participantFilter : true))
      .sort((a, b) => new Date(b.loggedAt || b.logged_at || b.createdAt || b.created_at) - new Date(a.loggedAt || a.logged_at || a.createdAt || a.created_at))
  }, [behaviourLogs, participantFilter])

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function createEntry(e) {
    e.preventDefault()
    if (!form.participantId || !form.overview.trim()) {
      alert('Please choose a participant and add an overview.')
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
          severity: form.severity,
          outcome: form.overview.trim(),
          staffInitials: actorInitials,
        },
      ])

      setForm({
        participantId: '',
        overview: '',
        rating: '-',
        severity: 'medium',
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
                {[...participants].sort((a, b) => a.name.localeCompare(b.name)).map(participant => (
                  <option key={participant.id} value={participant.id}>{participant.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Rating *</label>
              <select className="input" value={form.rating} onChange={e => setField('rating', e.target.value)} required>
                {RATING_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Severity *</label>
              <select className="input" value={form.severity} onChange={e => setField('severity', e.target.value)} required>
                {SEVERITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Overview *</label>
              <textarea className="input resize-none" rows={4} value={form.overview} onChange={e => setField('overview', e.target.value)} placeholder="Overview of why this log is being made" required />
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
            <label className="label">Filter by participant</label>
            <select className="input" value={participantFilter} onChange={e => setParticipantFilter(e.target.value)}>
              <option value="">All participants</option>
              {[...participants].sort((a, b) => a.name.localeCompare(b.name)).map(participant => (
                <option key={participant.id} value={participant.id}>{participant.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {visibleLogs.length === 0 ? (
          <div className="card text-center py-10">
            <AlertTriangle size={28} className="mx-auto mb-2 text-stone-300" />
            <p className="text-stone-500 text-sm">No behaviour entries yet.</p>
          </div>
        ) : visibleLogs.map(entry => {
          return (
            <div key={entry.id} className="card border border-stone-200">
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
                <p><span className="font-semibold text-stone-900">Rating:</span> {entry.rating || entry.category || '-'}</p>
                <p><span className="font-semibold text-stone-900">Severity:</span> {entry.severity ? `${entry.severity.charAt(0).toUpperCase()}${entry.severity.slice(1)}` : 'Medium'}</p>
                <p><span className="font-semibold text-stone-900">Overview:</span> {entry.overview || entry.outcome || entry.triggerText || entry.actionTaken || '—'}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
