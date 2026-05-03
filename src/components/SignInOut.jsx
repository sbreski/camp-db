import { useEffect, useState } from 'react'
import { LogIn, LogOut, Clock, CheckCircle, Search, RotateCcw, User, X, Calendar, CameraOff, Camera, FileText, Edit2, Trash2, Check } from 'lucide-react'
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

function formatMultilineHistoryText(value) {
  return String(value || '').replace(/\r\n/g, '\n')
}

function formatRegisterInlineText(value) {
  return formatMultilineHistoryText(value).replace(/\n+/g, ' | ').trim()
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

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function canLeaveAlone(participant) {
  return Boolean(participant?.canLeaveAlone ?? participant?.can_leave_alone) && Number(participant?.age) >= 11
}

function getSiblingLeaveOptions(participant, participants) {
  const parentNameKey = normalizeText(participant?.parentName)
  const parentEmailKey = normalizeText(participant?.parentEmail)
  const parentPhoneKey = normalizePhone(participant?.parentPhone)

  return (participants || [])
    .filter(candidate => {
      if (!candidate || candidate.id === participant?.id) return false
      if (!canLeaveAlone(candidate)) return false
      const sameName = parentNameKey && normalizeText(candidate.parentName) === parentNameKey
      const sameEmail = parentEmailKey && normalizeText(candidate.parentEmail) === parentEmailKey
      const samePhone = parentPhoneKey && normalizePhone(candidate.parentPhone) === parentPhoneKey
      return sameName || sameEmail || samePhone
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(candidate => ({
      id: candidate.id,
      label: `Leave with sibling, ${candidate.name}`,
    }))
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

function CollectionModal({ participant, participants, onConfirm, onCancel }) {
  const adults = parseApprovedAdults(participant.approvedAdults)
  const [selected, setSelected] = useState(null)
  const [otherFullName, setOtherFullName] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [validationError, setValidationError] = useState('')
  const siblingLeaveOptions = getSiblingLeaveOptions(participant, participants)
  const numberedCollectors = [...siblingLeaveOptions.map(option => option.label), ...adults]

  const can_leave_alone = canLeaveAlone(participant)
  const hasSelectableOptions = can_leave_alone || siblingLeaveOptions.length > 0 || adults.length > 0

  useEffect(() => {
    function isTypingField(target) {
      if (!target) return false
      const tag = String(target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      return Boolean(target.isContentEditable)
    }

    function handleKeyDown(event) {
      if (isTypingField(event.target)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
        return
      }

      if (/^[1-9]$/.test(event.key)) {
        const optionIndex = Number(event.key) - 1
        const option = numberedCollectors[optionIndex]
        if (option) {
          event.preventDefault()
          selectCollector(option)
        }
        return
      }

      if (event.key === '0' && can_leave_alone) {
        event.preventDefault()
        selectCollector('LeaveAlone')
        return
      }

      if (event.key === 'Enter') {
        if (hasSelectableOptions && !selected) return
        event.preventDefault()
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [numberedCollectors, can_leave_alone, hasSelectableOptions, selected, onCancel])

  function handleConfirm() {
    if (can_leave_alone && selected === 'LeaveAlone') {
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
          {can_leave_alone && (
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
          {adults.length > 0 || siblingLeaveOptions.length > 0 ? (
            <>
              <p className="text-sm font-medium text-stone-700">Who is collecting?</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {siblingLeaveOptions.map((option, i) => (
                  <button key={option.id} onClick={() => selectCollector(option.label)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selected === option.label ? 'border-indigo-600 bg-indigo-50' : 'border-stone-200 hover:border-stone-300'
                    }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display flex-shrink-0 ${
                      selected === option.label ? 'bg-indigo-900 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>{i + 1}</div>
                    <span className="text-sm font-medium text-stone-800">{option.label}</span>
                  </button>
                ))}
                {adults.map((adult, i) => (
                  <button key={i} onClick={() => selectCollector(adult)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selected === adult ? 'border-forest-600 bg-forest-50' : 'border-stone-200 hover:border-stone-300'
                    }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display flex-shrink-0 ${
                      selected === adult ? 'bg-forest-900 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>{siblingLeaveOptions.length + i + 1}</div>
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
            disabled={hasSelectableOptions && !selected}
            className={`flex-1 btn-primary py-3 ${hasSelectableOptions && !selected ? 'opacity-40 cursor-not-allowed' : ''}`}>
            Confirm Sign Out
          </button>
          <button onClick={onCancel} className="btn-secondary px-4">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function SignInOut({ participants, setParticipants, attendance, setAttendance, actorInitials = 'ST', incidents, setIncidents, medicationAdministration = [], setMedicationAdministration, canViewAdminFollowUps = false }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all | in | not-in | follow-up
  const [flash, setFlash] = useState(null)
  const [collectingFor, setCollectingFor] = useState(null)
  const [noteEditor, setNoteEditor] = useState(null)
  const [noteInput, setNoteInput] = useState('')
  const [keepOnRecord, setKeepOnRecord] = useState(false)
  const [editingHistoryEntry, setEditingHistoryEntry] = useState(null)
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
  const liveNoteEditorParticipant = noteEditor
    ? participants.find(item => item.id === noteEditor.id) || noteEditor
    : null

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

  function getPendingMarFollowUps(participantId) {
    return medicationAdministration.filter(row =>
      row.participant_id === participantId &&
      row.follow_up_required &&
      !row.follow_up_completed_at
    )
  }

  async function completeMarFollowUp(marId) {
    const completedAt = new Date().toISOString()
    // Optimistic update locally
    if (typeof setMedicationAdministration === 'function') {
      setMedicationAdministration(prev => prev.map(row =>
        row.id === marId
          ? { ...row, follow_up_completed_at: completedAt, follow_up_completed_by: actorInitials }
          : row
      ))
    }
    // Also persist to Supabase if available
    try {
      const { supabase } = await import('../supabase')
      await supabase
        .from('medication_administration')
        .update({ follow_up_completed_at: completedAt, follow_up_completed_by: actorInitials })
        .eq('id', marId)
    } catch (_) {
      // Supabase update is best-effort; local state already updated
    }
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
    const existingNote = existing?.exceptionNotes || existing?.exception_notes || ''
    setNoteEditor(participant)
    setNoteInput(existingNote)
    setKeepOnRecord(Boolean(participant.register_note) && participant.register_note === existingNote)
  }

  function cancelNoteEditor() {
    setNoteEditor(null)
    setNoteInput('')
    setKeepOnRecord(false)
    setEditingHistoryEntry(null)
  }

  function saveNoteEditor() {
    if (!noteEditor) return
    const existing = getRecord(noteEditor.id)
    const nextNote = noteInput.trim() || null

    // Save to today's attendance record as before
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

    // Persist note history and optional register follow-up to participant
    if (nextNote && typeof setParticipants === 'function') {
      setParticipants(prev => prev.map(p => {
        if (p.id !== noteEditor.id) return p
        const existingHistory = Array.isArray(p.note_history) ? p.note_history : []
        const newEntry = {
          id: crypto.randomUUID(),
          note: nextNote,
          date: selectedDate,
          addedBy: actorInitials,
          savedAt: new Date().toISOString(),
        }
        return {
          ...p,
          note_history: [...existingHistory, newEntry],
          register_note: keepOnRecord ? nextNote : null,
        }
      }))
    } else if (!nextNote && typeof setParticipants === 'function') {
      setParticipants(prev => prev.map(p => {
        if (p.id !== noteEditor.id) return p
        return { ...p, register_note: null }
      }))
    }

    cancelNoteEditor()
  }

  function clearNoteEditor() {
    setNoteInput('')
    setKeepOnRecord(false)
  }

  function beginEditHistoryEntry(entry, historyIndex) {
    const participant = participants.find(item => item.id === noteEditor?.id)
    const activeFollowUp = String(participant?.register_note || participant?.registerNote || '').trim()
    setEditingHistoryEntry({
      historyIndex,
      originalNote: String(entry.note || ''),
      note: String(entry.note || ''),
      keepOnRecord: activeFollowUp === String(entry.note || '').trim(),
    })
  }

  function cancelEditHistoryEntry() {
    setEditingHistoryEntry(null)
  }

  function saveHistoryEntryEdit() {
    if (!noteEditor || !editingHistoryEntry || typeof setParticipants !== 'function') return
    const nextNote = String(editingHistoryEntry.note || '').trim()
    if (!nextNote) return
    const participantId = noteEditor.id

    setParticipants(prev => prev.map(p => {
      if (p.id !== participantId) return p
      const existingHistory = Array.isArray(p.note_history) ? p.note_history : []
      const previousEntry = existingHistory[editingHistoryEntry.historyIndex]
      const previousNote = String(previousEntry?.note || editingHistoryEntry.originalNote || '').trim()
      return {
        ...p,
        note_history: existingHistory.map((entry, index) => (
          index === editingHistoryEntry.historyIndex
            ? {
                ...entry,
                note: nextNote,
                updatedAt: new Date().toISOString(),
                updatedBy: actorInitials,
              }
            : entry
        )),
        register_note: editingHistoryEntry.keepOnRecord
          ? nextNote
          : String(p.register_note || '').trim() === previousNote
            ? null
            : p.register_note,
      }
    }))

    setAttendance(prev => prev.map(record => (
      record.participantId === participantId
      && record.date === liveNoteEditorParticipant?.note_history?.[editingHistoryEntry.historyIndex]?.date
      && String(record.exceptionNotes || record.exception_notes || '').trim() === String(editingHistoryEntry.originalNote || '').trim()
        ? { ...record, exceptionNotes: nextNote }
        : record
    )))

    setEditingHistoryEntry(null)
  }

  function deleteHistoryEntry(historyIndex) {
    if (!noteEditor || typeof setParticipants !== 'function') return
    if (!window.confirm('Delete this saved note from history?')) return
    const participantId = noteEditor.id
    const removedEntry = liveNoteEditorParticipant?.note_history?.[historyIndex]
    const removedNote = String(removedEntry?.note || '').trim()

    setParticipants(prev => prev.map(p => {
      if (p.id !== participantId) return p
      const existingHistory = Array.isArray(p.note_history) ? p.note_history : []
      return {
        ...p,
        note_history: existingHistory.filter((_, index) => index !== historyIndex),
        register_note: String(p.register_note || '').trim() === removedNote ? null : p.register_note,
      }
    }))

    setAttendance(prev => prev.map(record => (
      record.participantId === participantId
      && record.date === removedEntry?.date
      && String(record.exceptionNotes || record.exception_notes || '').trim() === removedNote
        ? { ...record, exceptionNotes: null }
        : record
    )))

    if (editingHistoryEntry?.historyIndex === historyIndex) {
      setEditingHistoryEntry(null)
    }
  }

  function clearRegisterFollowUp(participantId) {
    if (!window.confirm('Mark this note follow-up as done? It will remain in note history.')) return
    if (typeof setParticipants === 'function') {
      setParticipants(prev => prev.map(p =>
        p.id === participantId ? { ...p, register_note: null } : p
      ))
    }
  }

  function hasParticipantNoteFollowUp(participantId) {
    const participant = participants.find(item => item.id === participantId)
    return Boolean(String(participant?.register_note || participant?.registerNote || '').trim())
  }

  function clearParticipantNoteFollowUp(participantId) {
    clearRegisterFollowUp(participantId)
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
    const hasMarFollowUp = getPendingMarFollowUps(p.id).length > 0
    return hasIncidentFollowUp || hasNoteFollowUp || hasMarFollowUp
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
          <td class="check-cell"><span class="checkbox"></span></td>
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
            h1 { margin: 0 0 4px; font-size: 22px; }
            .meta { margin-bottom: 6px; color: #6b7280; font-size: 12px; }
            .instruction { margin-bottom: 14px; font-size: 11px; color: #9ca3af; font-style: italic; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
            .check-cell { width: 36px; text-align: center; }
            .checkbox {
              display: inline-block;
              width: 18px;
              height: 18px;
              border: 2px solid #374151;
              border-radius: 3px;
              vertical-align: middle;
            }
            @media print {
              body { margin: 12px; }
            }
          </style>
        </head>
        <body>
          <h1>🔥 Fire Record — On Site Register</h1>
          <div class="meta">Date: ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB')} · Generated: ${new Date().toLocaleString('en-GB')} · Total on site: ${onSiteList.length}</div>
          <div class="instruction">Tick each box as you account for each person at the assembly point.</div>
          <table>
            <thead>
              <tr><th class="check-cell">✓</th><th>Participant</th><th>Pronouns</th><th>Age</th><th>Signed In</th></tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5">No participants currently signed in.</td></tr>'}
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
        <CollectionModal participant={collectingFor} participants={participants} onConfirm={confirmSignOut} onCancel={() => setCollectingFor(null)} />
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
                <label className="label">Today's Note</label>
                <textarea
                  className="input min-h-[100px]"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Add handover notes, follow-up reminders, or important context for this participant."
                />
              </div>
              {/* Register follow-up checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={keepOnRecord}
                  onChange={e => setKeepOnRecord(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-forest-900 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-medium text-stone-800 group-hover:text-forest-900">Pin for follow up</span>
                  <p className="text-xs text-stone-500 mt-0.5">Show this note as a follow-up on the Sign In / Out register until it is marked done.</p>
                </div>
              </label>
              {/* Note history */}
              {Array.isArray(liveNoteEditorParticipant?.note_history) && liveNoteEditorParticipant.note_history.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Note History</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {[...liveNoteEditorParticipant.note_history].reverse().map((entry, i) => {
                      const historyIndex = liveNoteEditorParticipant.note_history.length - 1 - i
                      const isEditingEntry = editingHistoryEntry?.historyIndex === historyIndex
                      return (
                        <div key={entry.id || `${entry.savedAt || entry.date || 'note'}-${historyIndex}`} className="rounded-lg bg-stone-50 border border-stone-100 px-3 py-2">
                          {isEditingEntry ? (
                            <div className="space-y-2">
                              <textarea
                                className="input min-h-[88px]"
                                value={editingHistoryEntry.note}
                                onChange={e => setEditingHistoryEntry(prev => ({ ...prev, note: e.target.value }))}
                              />
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editingHistoryEntry.keepOnRecord}
                                  onChange={e => setEditingHistoryEntry(prev => ({ ...prev, keepOnRecord: e.target.checked }))}
                                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-forest-900 cursor-pointer"
                                />
                                <span className="text-xs text-stone-600">Pin for follow up</span>
                              </label>
                              <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={saveHistoryEntryEdit} className="text-xs font-semibold text-forest-800 hover:text-forest-950 inline-flex items-center gap-1">
                                  <Check size={13} /> Save
                                </button>
                                <button type="button" onClick={cancelEditHistoryEntry} className="text-xs font-semibold text-stone-500 hover:text-stone-800 inline-flex items-center gap-1">
                                  <X size={13} /> Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-stone-700 whitespace-pre-wrap flex-1">{formatMultilineHistoryText(entry.note)}</p>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button type="button" onClick={() => beginEditHistoryEntry(entry, historyIndex)} className="text-stone-400 hover:text-forest-700" title="Edit saved note">
                                    <Edit2 size={13} />
                                  </button>
                                  <button type="button" onClick={() => deleteHistoryEntry(historyIndex)} className="text-stone-400 hover:text-red-600" title="Delete saved note">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-stone-400 mt-1">
                                {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB')}
                                {entry.addedBy ? ` · ${entry.addedBy}` : ''}
                              </p>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
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
                  const hasMarFollowUp = getPendingMarFollowUps(p.id).length > 0
                  return hasIncidentFollowUp || hasNoteFollowUp || hasMarFollowUp
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
              const pendingMarFollowUps = getPendingMarFollowUps(p.id)
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
              const noteFollowUp = String(p.register_note || p.registerNote || '').trim()
              const absenceReasonLocked = Boolean(rec?.signIn || rec?.signOut)

              return (
                <div key={p.id}
                  className={`sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:gap-2 sm:items-center px-3 py-3 transition-all ${
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
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 cursor-help"
                          title={String(p.medicalType || '').trim() || 'No medical details recorded'}
                        >
                          M
                        </span>
                      )}
                      {hasSend && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 cursor-help"
                          title={String(p.sendNeeds || '').trim() || 'No SEND/support details recorded'}
                        >
                          S
                        </span>
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
                          const isToday = incident.followUpTiming === 'today'
                          const isOverdue = incident.followUpDueDate < selectedDate
                          return (
                            <div
                              key={incident.id}
                              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                                isToday
                                  ? 'border-orange-200 bg-orange-50 text-orange-800'
                                  : isOverdue
                                  ? 'border-red-200 bg-red-50 text-red-800'
                                  : 'border-amber-200 bg-amber-50 text-amber-800'
                              }`}
                            >
                              <span>
                                {isToday
                                  ? `⚠️ ${incident.type} — inform parent/carer at pickup today`
                                  : `Follow Up: ${incident.type}${isOverdue
                                      ? ` (overdue since ${new Date(incident.followUpDueDate + 'T12:00:00').toLocaleDateString('en-GB')})`
                                      : ` (due ${new Date(incident.followUpDueDate + 'T12:00:00').toLocaleDateString('en-GB')})`}`
                                }
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
                    {pendingMarFollowUps.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {pendingMarFollowUps.map(row => {
                          const when = row.administered_at ? new Date(row.administered_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
                          const medLabel = row.medication_name || 'Ad-hoc medication'
                          return (
                            <div
                              key={row.id}
                              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
                            >
                              <span>
                                Medication Follow Up: {medLabel} given {when} — inform parent at pickup
                              </span>
                              <button
                                type="button"
                                onClick={() => completeMarFollowUp(row.id)}
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
                            Follow Up Note: {formatRegisterInlineText(noteFollowUp)}
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

                  {/* Sign in/out times — inline on mobile, columns on desktop */}
                  <div className="sm:hidden flex items-center gap-3 mt-1 mb-1">
                    {rec?.signIn && (
                      <button onClick={() => startEditTime(p.id, 'signIn', rec.signIn)}
                        className="text-xs font-mono text-green-700 font-semibold hover:bg-green-50 px-1.5 py-0.5 rounded">
                        ↓ {fmt(rec?.signIn)}{isLate ? ' · Late' : ''}
                      </button>
                    )}
                    {rec?.signOut && (
                      <button onClick={() => startEditTime(p.id, 'signOut', rec.signOut)}
                        className="text-xs font-mono text-blue-700 font-semibold hover:bg-blue-50 px-1.5 py-0.5 rounded">
                        ↑ {fmt(rec?.signOut)}{isLatePickup ? ' · Late pickup' : ''}
                      </button>
                    )}
                  </div>

                  {/* Sign in time — desktop only */}
                  <div className="hidden sm:block text-right sm:w-24">
                    <div className="flex flex-col items-end gap-0.5">
                      {rec?.signIn ? (
                        <button
                          className="text-xs font-mono text-green-700 font-semibold cursor-pointer hover:bg-green-50 px-2 py-1 rounded transition-colors"
                          onClick={() => startEditTime(p.id, 'signIn', rec.signIn)}
                        >
                          {fmt(rec?.signIn)}
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-stone-300">{fmt(rec?.signIn)}</span>
                      )}
                      {isLate && <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Late</span>}
                      {signInBy && <span className="text-[10px] text-stone-500">by {signInBy}</span>}
                    </div>
                  </div>

                  {/* Sign out time — desktop only */}
                  <div className="hidden sm:block text-right sm:w-24">
                    <div className="flex flex-col items-end gap-0.5">
                      {rec?.signOut ? (
                        <button
                          className="text-xs font-mono text-blue-700 font-semibold cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                          onClick={() => startEditTime(p.id, 'signOut', rec.signOut)}
                        >
                          {fmt(rec?.signOut)}
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-stone-300">{fmt(rec?.signOut)}</span>
                      )}
                      {signOutBy && <span className="text-[10px] text-stone-500">by {signOutBy}</span>}
                      {isLatePickup && <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Late pickup</span>}
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-row sm:flex-row items-center gap-1.5 justify-start sm:justify-end sm:w-40 mt-2 sm:mt-0 flex-wrap">
                    {!rec?.signIn && (
                      <button onClick={() => signIn(p)}
                        className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-display font-semibold bg-amber-500 hover:bg-amber-600 text-white active:scale-95 transition-all">
                        <LogIn size={12} /> In
                      </button>
                    )}
                    {rec?.signIn && !rec?.signOut && (
                      <>
                        <button onClick={() => setCollectingFor(p)}
                          className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-display font-semibold bg-forest-900 hover:bg-forest-800 text-white active:scale-95 transition-all">
                          <LogOut size={12} /> Out
                        </button>
                        <button onClick={() => undoSignIn(p)} title="Undo sign-in"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-all">
                          <RotateCcw size={13} />
                        </button>
                      </>
                    )}
                    <button onClick={() => openNoteEditor(p)} title="Edit participant notes"
                      className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 active:scale-95 transition-all">
                      <FileText size={12} /> Notes
                    </button>
                    {!absenceReasonLocked && (
                      <button
                        onClick={() => openReasonEditor(p)}
                        title="Add absence reason"
                        className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold active:scale-95 transition-all bg-amber-50 hover:bg-amber-100 text-amber-800"
                      >
                        <Calendar size={12} /> <span className="sm:inline hidden">Absence Reason</span><span className="sm:hidden">Absent</span>
                      </button>
                    )}
                    {rec?.signOut && (
                      <button onClick={() => undoSignOut(p)} title="Undo sign-out"
                        className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-medium bg-stone-100 hover:bg-red-100 hover:text-red-700 text-stone-500 active:scale-95 transition-all">
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
