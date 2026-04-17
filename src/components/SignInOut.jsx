import { useState } from 'react'
import { LogIn, LogOut, Clock, CheckCircle, Search, RotateCcw, User, X, Calendar, CameraOff, Camera, FileText } from 'lucide-react'
import ParticipantNameText, { participantDisplayName } from './ParticipantNameText'
import SafeguardingFlagIcon from './SafeguardingFlagIcon'
import { getPendingFollowUpsForParticipant } from '../utils/workflow'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function parseApprovedAdults(str) {
  if (!str) return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

function formatParentLabel(parentName) {
  return `${parentName} (Parent)`
}

function hasSameAdult(adults, parentName) {
  const formatted = formatParentLabel(parentName)
  return adults.some(a => a.toLowerCase() === formatted.toLowerCase())
}

function collectorDisplayLabel(collectedBy) {
  if (!collectedBy) return null
  const otherMatch = collectedBy.match(/^Other \(not approved\):\s*(.+?)\s*-\s*Reason:\s*(.+)$/i)
  if (!otherMatch) return collectedBy
  return `Other: ${otherMatch[1].trim()}`
}

function isLikelyFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length >= 2 && parts.every(part => part.length >= 2)
}

const ATTENDANCE_REASON_OPTIONS = [
  { value: 'illness', label: 'Illness' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'no_show', label: 'No-show' },
  { value: 'late_arrival', label: 'Late arrival' },
  { value: 'early_leave', label: 'Early leave' },
  { value: 'other', label: 'Other' },
]

function attendanceReasonLabel(value) {
  return ATTENDANCE_REASON_OPTIONS.find(option => option.value === value)?.label || null
}

function photoConsentMode(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'no') return 'no'
  if (normalized === 'internal') return 'internal'
  return 'ok'
}

function CollectionModal({ participant, onConfirm, onCancel }) {
  const adults = parseApprovedAdults(participant.approvedAdults)
  const [selected, setSelected] = useState(null)
  const [otherFullName, setOtherFullName] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [validationError, setValidationError] = useState('')

  const canLeaveAlone = participant.canLeaveAlone && Number(participant.age) >= 11

  function handleConfirm() {
    if (canLeaveAlone && selected === 'LeaveAlone') {
      onConfirm('Left by themselves')
      return
    }
    if (selected !== 'Other / not on approved list') {
      onConfirm(selected || 'Not recorded')
      return
    }

    const fullName = otherFullName.trim()
    const reason = otherReason.trim()

    if (!isLikelyFullName(fullName)) {
      setValidationError('Please enter the collector\'s full name (first and last name).')
      return
    }
    if (!reason) {
      setValidationError('Please enter a reason for using someone not on the approved list.')
      return
    }

    onConfirm(`Other (not approved): ${fullName} - Reason: ${reason}`)
  }

  function selectCollector(value) {
    setSelected(value)
    setValidationError('')
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-in">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <h3 className="font-display font-bold text-forest-950">Sign Out</h3>
            <ParticipantNameText participant={participant} className="text-sm text-stone-500 mt-0.5" showDiagnosedHighlight={false} />
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          {canLeaveAlone && (
            <button
              onClick={() => selectCollector('LeaveAlone')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                selected === 'LeaveAlone' ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200 hover:border-stone-300'
              }`}
              title="This participant is permitted to leave the premises on their own (parental permission, age 11+)."
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display flex-shrink-0 ${
                selected === 'LeaveAlone' ? 'bg-emerald-900 text-white' : 'bg-stone-100 text-stone-600'
              }`}>✓</div>
              <span className="text-sm font-medium text-emerald-800">
                Leave Site Unaccompanied
                <span className="block text-xs text-stone-500 font-normal">(parental permission, age 11+)</span>
              </span>
            </button>
          )}
          {adults.length > 0 ? (
            <>
              <p className="text-sm font-medium text-stone-700">Who is collecting?</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {adults.map((adult, i) => (
                  <button key={i} onClick={() => selectCollector(adult)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selected === adult ? 'border-forest-600 bg-forest-50' : 'border-stone-200 hover:border-stone-300'
                    }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display flex-shrink-0 ${
                      selected === adult ? 'bg-forest-900 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>{i + 1}</div>
                    <span className="text-sm font-medium text-stone-800">{adult}</span>
                  </button>
                ))}
                <button onClick={() => selectCollector('Other / not on approved list')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    selected === 'Other / not on approved list' ? 'border-amber-500 bg-amber-50' : 'border-dashed border-stone-200 hover:border-stone-300'
                  }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selected === 'Other / not on approved list' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-400'
                  }`}><User size={13} /></div>
                  <span className="text-sm text-stone-500 italic">Other / not on approved list</span>
                </button>
                {selected === 'Other / not on approved list' && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                    <div>
                      <label className="label">Collector full name</label>
                      <input
                        type="text"
                        className="input"
                        value={otherFullName}
                        onChange={e => {
                          setOtherFullName(e.target.value)
                          if (validationError) setValidationError('')
                        }}
                        placeholder="First and last name"
                      />
                    </div>
                    <div>
                      <label className="label">Reason for change</label>
                      <textarea
                        className="input min-h-[84px]"
                        value={otherReason}
                        onChange={e => {
                          setOtherReason(e.target.value)
                          if (validationError) setValidationError('')
                        }}
                        placeholder="Why is this person collecting instead of an approved adult?"
                      />
                    </div>
                    {validationError && (
                      <p className="text-xs font-medium text-red-600">{validationError}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-stone-500">No approved adults recorded for this participant.</p>
              <p className="text-xs text-stone-400 mt-1">Add them via the Participants page.</p>
            </div>
          )}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={handleConfirm}
            disabled={adults.length > 0 && !selected && !(canLeaveAlone && selected === 'LeaveAlone')}
            className={`flex-1 btn-primary py-3 ${adults.length > 0 && !selected && !(canLeaveAlone && selected === 'LeaveAlone') ? 'opacity-40 cursor-not-allowed' : ''}`}>
            Confirm Sign Out
          </button>
          <button onClick={onCancel} className="btn-secondary px-4">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function SignInOut({ participants, attendance, setAttendance, actorInitials = 'ST', incidents, setIncidents, canViewAdminFollowUps = false }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | in | not-in | follow-up
  const [flash, setFlash] = useState(null)
  const [collectingFor, setCollectingFor] = useState(null)
  const [noteEditor, setNoteEditor] = useState(null)
  const [noteInput, setNoteInput] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [editingTime, setEditingTime] = useState(null) // { participantId, type: 'signIn' | 'signOut', currentTime }
  const [timeInput, setTimeInput] = useState('')
  const [reasonEditor, setReasonEditor] = useState(null)
  const [reasonInput, setReasonInput] = useState('')
  const [reasonNotesInput, setReasonNotesInput] = useState('')
  const today = todayKey()
  const seasonParticipants = participants.filter(p => {
    const seasonFlag = p.isActiveThisSeason ?? p.is_active_this_season
    if (typeof seasonFlag === 'string') return seasonFlag.toLowerCase() !== 'false'
    return seasonFlag !== false
  })
  const selectedRecords = attendance.filter(a => a.date === selectedDate)

  function getPendingFollowUps(participantId) {
    return getPendingFollowUpsForParticipant(incidents, participantId, selectedDate)
  }

  function completeFollowUp(incidentId) {
    setIncidents(prev => prev.map(incident => (
      incident.id === incidentId
        ? {
            ...incident,
            followUpCompletedAt: new Date().toISOString(),
            followUpCompletedBy: 'Register follow-up',
          }
        : incident
    )))
  }

  function getRecord(participantId) {
    return selectedRecords.find(r => r.participantId === participantId) || null
  }

  function signIn(participant) {
    const now = new Date()
    // For non-today dates, use a predictable default sign-in time on that selected day.
    const signInTime = selectedDate === today ? now : new Date(`${selectedDate}T10:00:00`)
    
    setAttendance(prev => [
      ...prev.filter(r => !(r.date === selectedDate && r.participantId === participant.id)),
      { 
        participantId: participant.id, 
        date: selectedDate, 
        signIn: signInTime.toISOString(), 
        signOut: null, 
        signInBy: actorInitials,
        signOutBy: null,
        collectedBy: null, 
        id: `${participant.id}-${selectedDate}` 
      }
    ])
    setFlash({ id: participant.id, type: 'in' })
    setTimeout(() => setFlash(null), 2000)
  }

  function undoSignIn(participant) {
    if (!window.confirm(`Undo sign-in for ${participantDisplayName(participant)}?`)) return
    setAttendance(prev => prev.filter(r => !(r.date === selectedDate && r.participantId === participant.id)))
  }

  function undoSignOut(participant) {
    if (!window.confirm(`Undo sign-out for ${participantDisplayName(participant)}? They will show as still on site.`)) return
    const existing = getRecord(participant.id)
    setAttendance(prev => prev.map(r => r.id === existing.id ? { ...r, signOut: null, signOutBy: null, collectedBy: null } : r))
  }

  function confirmSignOut(collectedBy) {
    const participant = collectingFor
    setCollectingFor(null)
    const existing = getRecord(participant.id)
    if (!existing) return
    
    const now = new Date()
    // For non-today dates, use a predictable default sign-out time on that selected day.
    const signOutTime = selectedDate === today ? now : new Date(`${selectedDate}T16:00:00`)
    
    setAttendance(prev => prev.map(r => r.id === existing.id ? { ...r, signOut: signOutTime.toISOString(), signOutBy: actorInitials, collectedBy } : r))
    setFlash({ id: participant.id, type: 'out' })
    setTimeout(() => setFlash(null), 2000)
  }

  function openNoteEditor(participant) {
    const existing = getRecord(participant.id)
    setNoteEditor(participant)
    setNoteInput(existing?.exceptionNotes || existing?.exception_notes || '')
  }

  function cancelNoteEditor() {
    setNoteEditor(null)
    setNoteInput('')
  }

  function saveNoteEditor() {
    if (!noteEditor) return
    const existing = getRecord(noteEditor.id)
    const nextNote = noteInput.trim() || null

    if (existing) {
      setAttendance(prev => prev.map(r => (
        r.id === existing.id
          ? { ...r, exceptionNotes: nextNote }
          : r
      )))
    } else {
      setAttendance(prev => [
        ...prev,
        {
          id: `${noteEditor.id}-${selectedDate}`,
          participantId: noteEditor.id,
          date: selectedDate,
          signIn: null,
          signOut: null,
          signInBy: null,
          signOutBy: null,
          collectedBy: null,
          exceptionReason: null,
          exceptionNotes: nextNote,
        },
      ])
    }

    cancelNoteEditor()
  }

  function clearNoteEditor() {
    setNoteInput('')
  }

  function hasParticipantNoteFollowUp(participantId) {
    const record = getRecord(participantId)
    return Boolean(String(record?.exceptionNotes || record?.exception_notes || '').trim())
  }

  function clearParticipantNoteFollowUp(participantId) {
    const existing = getRecord(participantId)
    if (!existing) return
    setAttendance(prev => prev.map(r => (
      r.id === existing.id
        ? { ...r, exceptionNotes: null }
        : r
    )))
  }

  function startEditTime(participantId, type, currentTime) {
    const record = getRecord(participantId)
    if (!record) return

    const date = new Date(currentTime)
    const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    setEditingTime({ participantId, type, currentTime })
    setTimeInput(timeString)
  }

  function saveTime() {
    if (!editingTime) return

    const [hours, minutes] = timeInput.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      alert('Please enter a valid time in HH:MM format')
      return
    }

    const record = getRecord(editingTime.participantId)
    if (!record) return

    const dateTime = new Date(`${selectedDate}T${timeInput}:00`)
    const updatedRecord = {
      ...record,
      [editingTime.type]: dateTime.toISOString(),
      ...(editingTime.type === 'signIn' ? { signInBy: actorInitials } : { signOutBy: actorInitials }),
    }

    setAttendance(prev => prev.map(r => r.id === record.id ? updatedRecord : r))
    setEditingTime(null)
    setTimeInput('')
  }

  function cancelEditTime() {
    setEditingTime(null)
    setTimeInput('')
  }

  function openReasonEditor(participant) {
    const existing = getRecord(participant.id)
    if (existing?.signIn || existing?.signOut) {
      return
    }
    setReasonEditor(participant)
    setReasonInput(existing?.exceptionReason || '')
    setReasonNotesInput(existing?.exceptionNotes || '')
  }

  function cancelReasonEditor() {
    setReasonEditor(null)
    setReasonInput('')
    setReasonNotesInput('')
  }

  function saveReasonEditor() {
    if (!reasonEditor) return
    if (!reasonInput) {
      alert('Please select a reason, or use Clear.')
      return
    }

    const existing = getRecord(reasonEditor.id)
    if (existing) {
      setAttendance(prev => prev.map(r => (
        r.id === existing.id
          ? { ...r, exceptionReason: reasonInput, exceptionNotes: reasonNotesInput.trim() || null }
          : r
      )))
    } else {
      setAttendance(prev => [
        ...prev,
        {
          id: `${reasonEditor.id}-${selectedDate}`,
          participantId: reasonEditor.id,
          date: selectedDate,
          signIn: null,
          signOut: null,
          signInBy: null,
          signOutBy: null,
          collectedBy: null,
          exceptionReason: reasonInput,
          exceptionNotes: reasonNotesInput.trim() || null,
        },
      ])
    }

    cancelReasonEditor()
  }

  function clearReasonEditor() {
    if (!reasonEditor) return
    const existing = getRecord(reasonEditor.id)
    if (existing) {
      setAttendance(prev => prev.map(r => (
        r.id === existing.id
          ? { ...r, exceptionReason: null, exceptionNotes: null }
          : r
      )))
    }
    cancelReasonEditor()
  }

  // Alphabetical by first name
  const sorted = [...seasonParticipants].sort((a, b) => a.name.localeCompare(b.name))
  const filtered = sorted.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const onSite = seasonParticipants.filter(p => { const r = getRecord(p.id); return r?.signIn && !r?.signOut })
  const notIn = seasonParticipants.filter(p => {
    const r = getRecord(p.id)
    return !(r?.signIn && !r?.signOut)
  })
  const participantsWithFollowUps = seasonParticipants.filter(p => {
    const hasIncidentFollowUp = getPendingFollowUps(p.id).length > 0
    const hasNoteFollowUp = canViewAdminFollowUps && hasParticipantNoteFollowUp(p.id)
    return hasIncidentFollowUp || hasNoteFollowUp
  }).length

  function printFireRecord() {
    const onSiteList = [...seasonParticipants]
      .filter(p => {
        const r = getRecord(p.id)
        return r?.signIn && !r?.signOut
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const rows = onSiteList.map(p => {
      const rec = getRecord(p.id)
      return `
        <tr>
          <td>${participantDisplayName(p)}</td>
          <td>${p.pronouns || '—'}</td>
          <td>${p.age ? `Age ${p.age}` : '—'}</td>
          <td>${fmt(rec?.signIn)}</td>
        </tr>
      `
    }).join('')

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Fire Register</title>
          <style>
            body { font-family: Georgia, serif; margin: 24px; color: #1f2937; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            .meta { margin-bottom: 14px; color: #6b7280; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Fire Record - On Site Register</h1>
          <div class="meta">Date: ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB')} · Generated: ${new Date().toLocaleString('en-GB')}</div>
          <table>
            <thead>
              <tr><th>Participant</th><th>Pronouns</th><th>Age</th><th>Signed In</th></tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4">No participants currently signed in.</td></tr>'}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) {
      alert('Allow pop-ups to print the fire register.')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  return (
    <div className="fade-in space-y-4">
      {collectingFor && (
        <CollectionModal participant={collectingFor} onConfirm={confirmSignOut} onCancel={() => setCollectingFor(null)} />
      )}
      {noteEditor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">Participant Notes</h3>
                <p className="text-sm text-stone-500 mt-0.5">{noteEditor.name}</p>
              </div>
              <button onClick={cancelNoteEditor} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input min-h-[120px]"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Add handover notes, follow-up reminders, or important context for this participant."
                />
              </div>
            </div>
            <div className="p-5 pt-0 flex gap-2">
              <button onClick={saveNoteEditor} className="btn-primary flex-1">Save Note</button>
              <button onClick={clearNoteEditor} className="btn-secondary">Clear</button>
              <button onClick={cancelNoteEditor} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {editingTime && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-in">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">
                  Edit {editingTime.type === 'signIn' ? 'Sign In' : 'Sign Out'} Time
                </h3>
                <ParticipantNameText
                  participant={participants.find(p => p.id === editingTime.participantId)}
                  className="text-sm text-stone-500 mt-0.5"
                  showDiagnosedHighlight={false}
                />
              </div>
              <button onClick={cancelEditTime} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Time (HH:MM)</label>
                <input
                  type="text"
                  value={timeInput}
                  onChange={e => setTimeInput(e.target.value)}
                  className="input w-full"
                  placeholder="HH:MM"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-5 pt-0 flex gap-2">
              <button onClick={saveTime} className="btn-primary flex-1">Save Time</button>
              <button onClick={cancelEditTime} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {reasonEditor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">Attendance Reason</h3>
                <ParticipantNameText participant={reasonEditor} className="text-sm text-stone-500 mt-0.5" showDiagnosedHighlight={false} />
              </div>
              <button onClick={cancelReasonEditor} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Reason</label>
                <select className="input" value={reasonInput} onChange={e => setReasonInput(e.target.value)}>
                  <option value="">Select reason...</option>
                  {ATTENDANCE_REASON_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  className="input min-h-[92px]"
                  value={reasonNotesInput}
                  onChange={e => setReasonNotesInput(e.target.value)}
                  placeholder="Add context, e.g. parent called at 08:30"
                />
              </div>
            </div>
            <div className="p-5 pt-0 flex flex-wrap gap-2">
              <button onClick={saveReasonEditor} className="btn-primary flex-1 min-w-[120px]">Save Reason</button>
              <button onClick={clearReasonEditor} className="btn-secondary min-w-[120px]">Clear</button>
              <button onClick={cancelReasonEditor} className="btn-secondary min-w-[120px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Sign In / Out</h2>
          <p className="text-stone-500 text-sm">
            {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {selectedDate === today && ' (Today)'}
          </p>
        </div>
        <div className="flex gap-2 text-center">
          <div className="card px-3 py-2">
            <p className="text-xl font-display font-bold text-amber-500">{onSite.length}</p>
            <p className="text-xs text-stone-500">On site</p>
          </div>
          <div className="card px-3 py-2">
            <p className="text-xl font-display font-bold text-stone-400">{notIn.length}</p>
            <p className="text-xs text-stone-500">Not in</p>
          </div>
        </div>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-stone-700">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="input"
        />
        <button
          onClick={() => setSelectedDate(today)}
          className="btn-secondary text-sm"
        >
          Today
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input type="text" placeholder="Search participants..." value={search}
          onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${statusFilter === 'all' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200'}`}
        >
          All
        </button>
        <button
          onClick={() => setStatusFilter('in')}
          className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${statusFilter === 'in' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200'}`}
        >
          In
        </button>
        <button
          onClick={() => setStatusFilter('not-in')}
          className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${statusFilter === 'not-in' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200'}`}
        >
          Not in
        </button>
        <button
          onClick={() => setStatusFilter('follow-up')}
          className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${statusFilter === 'follow-up' ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200'}`}
        >
          Follow Up ({participantsWithFollowUps})
        </button>
        <button onClick={printFireRecord} className="btn-secondary text-xs py-1.5">
          Print/PDF Fire Record (In only)
        </button>
      </div>

      {seasonParticipants.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-stone-400 text-sm">No participants are assigned to Sign In / Out this season.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* Header row */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-500 uppercase tracking-wide">
            <span>Participant</span>
            <span className="text-right w-24">Sign In</span>
            <span className="text-right w-24">Sign Out</span>
            <span className="text-right w-28">Action</span>
          </div>

          <div className="divide-y divide-stone-50">
            {filtered
              .filter(p => {
                if (statusFilter === 'all') return true
                if (statusFilter === 'follow-up') {
                  const hasIncidentFollowUp = getPendingFollowUps(p.id).length > 0
                  const hasNoteFollowUp = canViewAdminFollowUps && hasParticipantNoteFollowUp(p.id)
                  return hasIncidentFollowUp || hasNoteFollowUp
                }
                const rec = getRecord(p.id)
                const isInNow = !!(rec?.signIn && !rec?.signOut)
                return statusFilter === 'in' ? isInNow : !isInNow
              })
              .map(p => {
              const rec = getRecord(p.id)
              const isIn = rec?.signIn && !rec?.signOut
              const isOut = !!rec?.signOut
              const isFlashing = flash?.id === p.id
              const statusLabel = isIn ? 'Present' : isOut ? 'Signed out' : 'Absent'
              const statusClass = isIn
                ? 'text-emerald-700'
                : isOut
                  ? 'text-stone-500'
                  : 'text-red-700'

              // Check if sign-in was late (after 10:15am) - only for today
              const signInTime = rec?.signIn ? new Date(rec.signIn) : null
              const isLate = selectedDate === today && signInTime && (signInTime.getHours() > 10 || (signInTime.getHours() === 10 && signInTime.getMinutes() > 15))
              const signOutTime = rec?.signOut ? new Date(rec.signOut) : null
              const isLatePickup = selectedDate === today && signOutTime && (signOutTime.getHours() > 16 || (signOutTime.getHours() === 16 && signOutTime.getMinutes() > 15))

              const hasAllergy = p.medicalType?.includes('Allergy') || Boolean(String(p.allergyDetails || '').trim())
              const hasDietary = p.medicalType?.includes('Dietary') || Boolean(String(p.dietaryType || '').trim()) || Boolean(String(p.mealAdjustments || '').trim())
              const hasMedical = p.medicalType?.includes('Medical')
              const hasSend = !!p.sendNeeds
              const hasSafeguarding = !!p.safeguardingFlag
              const pendingFollowUps = getPendingFollowUps(p.id)
              const allergyTooltip = String(p.allergyDetails || '').trim() || 'No details recorded'
              const dietaryTooltip = [
                String(p.dietaryType || '').trim(),
                String(p.mealAdjustments || '').trim(),
              ].filter(Boolean).join(' - ') || 'No details recorded'
              const collectedByLabel = collectorDisplayLabel(rec?.collectedBy)
              const signInBy = rec?.signInBy || rec?.sign_in_by || null
              const signOutBy = rec?.signOutBy || rec?.sign_out_by || null
              const reasonLabel = attendanceReasonLabel(rec?.exceptionReason || rec?.exception_reason)
              const reasonNotes = rec?.exceptionNotes || rec?.exception_notes || ''
              const noteFollowUp = String(rec?.exceptionNotes || rec?.exception_notes || '').trim()
              const absenceReasonLocked = Boolean(rec?.signIn || rec?.signOut)

              return (
                <div key={p.id}
                  className={`sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:gap-2 sm:items-center px-4 py-3 transition-all ${
                    isFlashing ? 'bg-amber-50' : isIn ? 'bg-amber-50/40' : isOut ? 'bg-stone-50/60 opacity-75' : ''
                  }`}>

                  {/* Name + flags */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ParticipantNameText participant={p} className="font-display font-semibold text-forest-950 text-sm" showDiagnosedHighlight={false} />
                      {photoConsentMode(p.photoConsent) === 'no' && (
                        <CameraOff size={12} className="text-rose-700" title="No photo consent" />
                      )}
                      {photoConsentMode(p.photoConsent) === 'internal' && (
                        <span className="relative inline-flex" title="Photo consent: internal use only">
                          <Camera size={12} className="text-amber-700" />
                          <span className="absolute -top-1 -right-1 text-[8px] font-bold leading-none text-amber-900">!</span>
                        </span>
                      )}
                      {hasAllergy && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 cursor-help"
                          title={allergyTooltip}
                        >
                          A
                        </span>
                      )}
                      {hasDietary && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-200 cursor-help"
                          title={dietaryTooltip}
                        >
                          D
                        </span>
                      )}
                      {hasMedical && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">M</span>
                      )}
                      {hasSend && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">S</span>
                      )}
                      {hasSafeguarding && <SafeguardingFlagIcon size={11} />}
                      {isIn && <CheckCircle size={13} className="text-amber-500" />}
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {p.pronouns}{p.age ? ` · Age ${p.age}` : ''}
                      {collectedByLabel && !rec.signOut === false && (
                        <span className="ml-2 text-stone-500">· Collected by {collectedByLabel}</span>
                      )}
                      {isOut && collectedByLabel && (
                        <span className="ml-2 text-stone-500">· {collectedByLabel}</span>
                      )}
                    </p>
                    <p className={`text-xs mt-1 font-semibold ${statusClass}`}>{statusLabel}</p>
                    {reasonLabel && !isIn && (
                      <p className="text-xs mt-1 text-amber-700">
                        Absence Reason: <span className="font-medium">{reasonLabel}</span>{reasonNotes ? ` - ${reasonNotes}` : ''}
                      </p>
                    )}
                    {pendingFollowUps.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {pendingFollowUps.map(incident => {
                          const isOverdue = incident.followUpDueDate < selectedDate
                          return (
                            <div
                              key={incident.id}
                              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                                isOverdue
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : 'border-amber-200 bg-amber-50 text-amber-800'
                              }`}
                            >
                              <span>
                                Follow Up: {incident.type}
                                {isOverdue
                                  ? ` (overdue since ${new Date(incident.followUpDueDate + 'T12:00:00').toLocaleDateString('en-GB')})`
                                  : ` (due ${new Date(incident.followUpDueDate + 'T12:00:00').toLocaleDateString('en-GB')})`}
                              </span>
                              <button
                                type="button"
                                onClick={() => completeFollowUp(incident.id)}
                                className="ml-auto rounded bg-white/80 px-2 py-0.5 text-[11px] font-semibold hover:bg-white"
                              >
                                Mark done
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {canViewAdminFollowUps && noteFollowUp && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-900">
                          <span>
                            Follow Up Note: {noteFollowUp}
                          </span>
                          <button
                            type="button"
                            onClick={() => clearParticipantNoteFollowUp(p.id)}
                            className="ml-auto rounded bg-white/80 px-2 py-0.5 text-[11px] font-semibold hover:bg-white"
                          >
                            Mark done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sign in time */}
                  <div className="text-right sm:w-24 mt-2 sm:mt-0">
                    <div className="flex flex-col items-end gap-0.5">
                      {rec?.signIn ? (
                        <button
                          className="text-xs font-mono text-green-700 font-semibold cursor-pointer hover:bg-green-50 px-2 py-1 rounded transition-colors"
                          onClick={() => startEditTime(p.id, 'signIn', rec.signIn)}
                        >
                          {fmt(rec?.signIn)}
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-stone-300">
                          {fmt(rec?.signIn)}
                        </span>
                      )}
                      {isLate && (
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Late</span>
                      )}
                      {signInBy && (
                        <span className="text-[10px] text-stone-500">by {signInBy}</span>
                      )}
                    </div>
                  </div>

                  {/* Sign out time */}
                  <div className="text-right sm:w-24 mt-2 sm:mt-0">
                    <div className="flex flex-col items-end gap-0.5">
                      {rec?.signOut ? (
                        <button
                          className="text-xs font-mono text-blue-700 font-semibold cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                          onClick={() => startEditTime(p.id, 'signOut', rec.signOut)}
                        >
                          {fmt(rec?.signOut)}
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-stone-300">
                          {fmt(rec?.signOut)}
                        </span>
                      )}
                      {signOutBy && (
                        <span className="text-[10px] text-stone-500">by {signOutBy}</span>
                      )}
                      {isLatePickup && (
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Late pickup</span>
                      )}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 justify-end sm:w-40 mt-2 sm:mt-0">
                    {!rec?.signIn && (
                      <button onClick={() => signIn(p)}
                        className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-amber-500 hover:bg-amber-600 text-white active:scale-95 transition-all w-full sm:w-auto">
                        <LogIn size={12} /> In
                      </button>
                    )}
                    {rec?.signIn && !rec?.signOut && (
                      <>
                        <button onClick={() => undoSignIn(p)} title="Undo sign-in"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-all self-end sm:self-auto">
                          <RotateCcw size={13} />
                        </button>
                        <button onClick={() => setCollectingFor(p)}
                          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-forest-900 hover:bg-forest-800 text-white active:scale-95 transition-all w-full sm:w-auto">
                          <LogOut size={12} /> Out
                        </button>
                      </>
                    )}
                    <button onClick={() => openNoteEditor(p)} title="Edit participant notes"
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 active:scale-95 transition-all w-full sm:w-auto">
                      <FileText size={12} /> Notes
                    </button>
                    <button
                      onClick={() => openReasonEditor(p)}
                      title="Add absence reason"
                      className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold active:scale-95 transition-all w-full sm:w-auto ${
                        absenceReasonLocked ? 'bg-stone-50 text-stone-400 cursor-not-allowed opacity-50' : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                      }`}
                      disabled={absenceReasonLocked}
                    >
                      <Calendar size={12} /> Absence Reason
                    </button>
                    {rec?.signOut && (
                      <button onClick={() => undoSignOut(p)} title="Undo sign-out"
                        className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-medium bg-stone-100 hover:bg-red-100 hover:text-red-700 text-stone-500 active:scale-95 transition-all w-full sm:w-auto">
                        <RotateCcw size={12} /> Undo
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Key */}
      <div className="flex gap-3 flex-wrap text-xs text-stone-500">
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-red-100 text-red-700 border border-red-200">A</span> Allergy</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-green-100 text-green-800 border border-green-200">D</span> Dietary</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-blue-100 text-blue-700 border border-blue-200">M</span> Medical</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-purple-100 text-purple-700 border border-purple-200">S</span> SEND / Support</span>
        <span className="flex items-center gap-1"><SafeguardingFlagIcon size={11} /> Safeguarding flag</span>
      </div>
    </div>
  )
}
