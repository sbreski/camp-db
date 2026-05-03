import { useEffect, useState } from 'react'
import { ArrowLeft, Edit2, Clock, AlertTriangle, Phone, Mail, User, FileText, Share2, Trash2, MessageSquare, Paperclip, Check, X } from 'lucide-react'
import ParticipantForm from './ParticipantForm'
import IncidentForm from './IncidentForm'
import ParticipantNameText from './ParticipantNameText'
import SafeguardingFlagIcon from './SafeguardingFlagIcon'
import { supabase } from '../supabase'

function getNextDateKey(isoString) {
  const date = new Date(isoString)
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

function normalizeInitials(value) {
  return String(value || '').trim().toUpperCase()
}

function createdInitialsForIncident(incident) {
  return normalizeInitials(incident.createdByInitials || incident.created_by_initials)
}

function createdUserIdForIncident(incident) {
  return String(incident.createdByUserId || incident.created_by_user_id || '').trim()
}

function resolvedAtForIncident(incident) {
  return incident.resolvedAt || incident.resolved_at || null
}

function canAccessIncidentUpdates(incident, canViewSafeguarding) {
  if (incident.type !== 'Safeguarding') return true
  return Boolean(canViewSafeguarding)
}

function incidentNotesForIncident(incident) {
  const notes = incident.incidentNotes || incident.incident_notes
  return Array.isArray(notes) ? notes : []
}

function incidentDocumentsForIncident(incident) {
  const docs = incident.incidentDocuments || incident.incident_documents
  return Array.isArray(docs) ? docs : []
}

function participantNotesForParticipant(value) {
  const notes = value?.participantNotesHistory || value?.participant_notes_history
  return Array.isArray(notes) ? notes : []
}

function participantDocumentsForParticipant(value) {
  const docs = value?.participantDocuments || value?.participant_documents
  return Array.isArray(docs) ? docs : []
}

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const TABS = ['Overview', 'Medical', 'SEND / Support', 'Attendance', 'Incidents']

export default function ParticipantDetail({
  participant, participants, setParticipants,
  attendance, setAttendance, incidents, setIncidents, staffList = [], actorInitials = 'ST', actorUserId = '', currentStaffName = '', canViewSafeguarding = false, canViewSendDiagnosis = false, canManageShares = false, onNavigate, onBack
}) {
  const [editing, setEditing] = useState(false)
  const [showIncident, setShowIncident] = useState(false)
  const [editingIncidentId, setEditingIncidentId] = useState(null)
  const [saveNotice, setSaveNotice] = useState('')
  const [activeTab, setActiveTab] = useState('Overview')
  const [medicationForms, setMedicationForms] = useState([])
  const [medicationAdministration, setMedicationAdministration] = useState([])
  const [medicationPlans, setMedicationPlans] = useState([])
  const [loadingMedical, setLoadingMedical] = useState(false)
  const [shareUsers, setShareUsers] = useState([])
  const [shareItems, setShareItems] = useState([])
  const [shareCategories, setShareCategories] = useState(['send'])
  const [shareSummary, setShareSummary] = useState('')
  const [shareTargetUserIds, setShareTargetUserIds] = useState([])
  const [shareLoading, setShareLoading] = useState(false)
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState('')
  const [openingIncidentId, setOpeningIncidentId] = useState('')
  const [downloadingIncidentId, setDownloadingIncidentId] = useState('')
  const [participantNoteDraft, setParticipantNoteDraft] = useState('')
  const [editingParticipantNote, setEditingParticipantNote] = useState(null)
  const [editingRegisterHistoryEntry, setEditingRegisterHistoryEntry] = useState(null)
  const [uploadingParticipantDocument, setUploadingParticipantDocument] = useState(false)
  const [expandedIncidentId, setExpandedIncidentId] = useState('')
  const [noteDraftByIncident, setNoteDraftByIncident] = useState({})
  const [editingNote, setEditingNote] = useState(null)
  const [uploadingExtraIncidentId, setUploadingExtraIncidentId] = useState('')

  const editingIncident = incidents.find(inc => inc.id === editingIncidentId) || null
  const participantId = participant?.id || null
  const actorInitialsNormalized = normalizeInitials(actorInitials)

  function canEditSafeguardingIncident(incident) {
    if (incident.type !== 'Safeguarding') return true
    if (canViewSafeguarding) return true

    const createdByUserId = createdUserIdForIncident(incident)
    if (createdByUserId && actorUserId) {
      return createdByUserId === actorUserId
    }

    return createdInitialsForIncident(incident) === actorInitialsNormalized
  }

  function saveEdit(data) {
    const targetIds = Array.isArray(data?._linkedParticipantIds) && data._linkedParticipantIds.length > 0
      ? data._linkedParticipantIds
      : [participant.id]
    const { _linkedParticipantIds, ...updates } = data || {}
    setParticipants(prev => prev.map(p => (targetIds.includes(p.id) ? { ...p, ...updates } : p)))
    setEditing(false)
  }

  function dateKeyFromIso(isoString) {
    if (!isoString) return new Date().toISOString().slice(0, 10)
    return String(isoString).slice(0, 10)
  }

  function addPickupFollowUpNote(dateKey, message) {
    if (typeof setAttendance !== 'function' || !participant?.id || !message) return

    setAttendance(prev => {
      const existing = prev.find(item => item.participantId === participant.id && item.date === dateKey)
      const existingNote = String(existing?.exceptionNotes || existing?.exception_notes || '').trim()
      const hasMessageAlready = existingNote.toLowerCase().includes(message.toLowerCase())
      const combinedNote = hasMessageAlready
        ? existingNote
        : (existingNote ? `${existingNote}\n${message}` : message)

      if (existing) {
        return prev.map(item => (
          item.id === existing.id
            ? { ...item, exceptionNotes: combinedNote }
            : item
        ))
      }

      return [
        ...prev,
        {
          id: `${participant.id}-${dateKey}`,
          participantId: participant.id,
          date: dateKey,
          signIn: null,
          signOut: null,
          signInBy: null,
          signOutBy: null,
          collectedBy: null,
          exceptionReason: null,
          exceptionNotes: combinedNote,
        },
      ]
    })
  }

  async function saveIncident(data) {
    if (editingIncident) {
      await setIncidents(prev => prev.map(inc => {
        if (inc.id !== editingIncident.id) return inc
        const followUpRequired = Boolean(data.followUpRequired)
        return {
          ...inc,
          ...data,
          updatedByInitials: actorInitials,
          updatedByUserId: actorUserId || inc.updatedByUserId || null,
          id: inc.id,
          participantId: inc.participantId,
          createdAt: inc.createdAt,
          followUpRequired,
          followUpDueDate: followUpRequired ? (inc.followUpDueDate || getNextDateKey(inc.createdAt)) : null,
          followUpCompletedAt: followUpRequired ? inc.followUpCompletedAt : null,
          followUpCompletedBy: followUpRequired ? inc.followUpCompletedBy : null,
        }
      }))
      setSaveNotice('Report updated. Pickup handover note is available in Sign In/Out for today.')
      setShowIncident(false)
      setEditingIncidentId(null)
      return
    }

    const createdAt = new Date().toISOString()
    await setIncidents(prev => [...prev, {
      ...data,
      id: data.id || crypto.randomUUID(),
      createdByInitials: actorInitials,
      updatedByInitials: actorInitials,
      createdByUserId: actorUserId || null,
      updatedByUserId: actorUserId || null,
      participantId: participant.id,
      createdAt,
      followUpDueDate: data.followUpRequired ? getNextDateKey(createdAt) : null,
      followUpCompletedAt: null,
      followUpCompletedBy: null,
    }])

    const hasUploadedForm = Boolean(String(data?.pdfName || '').trim() || String(data?.pdfData || '').trim())
    if (hasUploadedForm) {
      addPickupFollowUpNote(
        dateKeyFromIso(createdAt),
        `${data.type || 'Incident'} form uploaded - discuss with pickup parent.`
      )
    }

    setSaveNotice('Report saved. Pickup handover note added in Sign In/Out for today.')

    setShowIncident(false)
  }

  function startEditIncident(inc) {
    if (!canEditSafeguardingIncident(inc)) {
      alert('Only authorised users or the original submitter can edit safeguarding submissions.')
      return
    }
    setEditingIncidentId(inc.id)
    setShowIncident(true)
  }

  function isSafeguardingResolved(incident) {
    return Boolean(resolvedAtForIncident(incident))
  }

  async function markSafeguardingResolved(incident) {
    if (incident.type !== 'Safeguarding') return
    if (!canViewSafeguarding) {
      alert('Only authorised safeguarding users can resolve safeguarding incidents.')
      return
    }
    if (isSafeguardingResolved(incident)) return

    const resolvedAt = new Date().toISOString()

    await setIncidents(prev => prev.map(inc => (
      inc.id === incident.id
        ? {
            ...inc,
            resolvedAt,
            resolvedBy: actorInitials,
            updatedByInitials: actorInitials,
            updatedByUserId: actorUserId || inc.updatedByUserId || null,
          }
        : inc
    )))

    await syncSafeguardingReportStatus(incident.id, 'close_report')

    await setParticipants(prev => prev.map(p => (
      p.id === incident.participantId
        ? { ...p, safeguardingFlag: false }
        : p
    )))
  }

  async function reopenSafeguardingIncident(incident) {
    if (incident.type !== 'Safeguarding') return
    if (!canViewSafeguarding) {
      alert('Only authorised safeguarding users can reopen safeguarding incidents.')
      return
    }
    if (!isSafeguardingResolved(incident)) return

    await setIncidents(prev => prev.map(inc => (
      inc.id === incident.id
        ? {
            ...inc,
            resolvedAt: null,
            resolvedBy: null,
            updatedByInitials: actorInitials,
            updatedByUserId: actorUserId || inc.updatedByUserId || null,
          }
        : inc
    )))

    await syncSafeguardingReportStatus(incident.id, 'reopen_report')

    await setParticipants(prev => prev.map(p => (
      p.id === incident.participantId
        ? { ...p, safeguardingFlag: true }
        : p
    )))
  }

  async function fetchSafeguardingDownloadUrlByIncidentId(incidentId) {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token

    if (!accessToken) {
      throw new Error('You must be logged in to access safeguarding reports')
    }

    const response = await fetch('/.netlify/functions/safeguarding-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: 'get_download_url', incidentId }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error || 'Failed to load safeguarding report')
    }

    return result.url
  }

  async function syncSafeguardingReportStatus(incidentId, action) {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token

    if (!accessToken || !incidentId) return

    const response = await fetch('/.netlify/functions/safeguarding-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, incidentId, actorInitials }),
    })

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      console.error(result.error || 'Unable to sync safeguarding report state')
    }
  }

  async function openIncidentReport(inc) {
    setOpeningIncidentId(inc.id)
    try {
      if (inc.type === 'Safeguarding') {
        if (!canViewSafeguarding) {
          alert('Safeguarding report access is restricted.')
          return
        }
        const url = await fetchSafeguardingDownloadUrlByIncidentId(inc.id)
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }

      if (!inc.pdfData) {
        alert('No attached form found for this report.')
        return
      }

      window.open(inc.pdfData, '_blank', 'noopener,noreferrer')
    } catch (error) {
      alert(error.message || 'Unable to open report')
    } finally {
      setOpeningIncidentId('')
    }
  }

  async function downloadIncidentReport(inc) {
    setDownloadingIncidentId(inc.id)
    try {
      let sourceUrl = ''

      if (inc.type === 'Safeguarding') {
        if (!canViewSafeguarding) {
          alert('Safeguarding report access is restricted.')
          return
        }
        sourceUrl = await fetchSafeguardingDownloadUrlByIncidentId(inc.id)
      } else {
        if (!inc.pdfData) {
          alert('No attached form found for this report.')
          return
        }
        sourceUrl = inc.pdfData
      }

      const response = await fetch(sourceUrl)
      if (!response.ok) throw new Error('Failed to download report file')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = inc.pdfName || `${String(inc.type || 'report').replace(/\s+/g, '-').toLowerCase()}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      alert(error.message || 'Unable to download report')
    } finally {
      setDownloadingIncidentId('')
    }
  }

  async function addIncidentNote(incident) {
    if (!canAccessIncidentUpdates(incident, canViewSafeguarding)) return
    const noteText = String(noteDraftByIncident[incident.id] || '').trim()
    if (!noteText) return

    const createdAt = new Date().toISOString()
    const nextNote = {
      id: crypto.randomUUID(),
      text: noteText,
      createdAt,
      createdBy: actorInitials,
      updatedAt: null,
      updatedBy: null,
    }

    await setIncidents(prev => prev.map(inc => (
      inc.id === incident.id
        ? {
            ...inc,
            incidentNotes: [...incidentNotesForIncident(inc), nextNote],
            updatedByInitials: actorInitials,
            updatedByUserId: actorUserId || inc.updatedByUserId || null,
          }
        : inc
    )))

    setNoteDraftByIncident(prev => ({ ...prev, [incident.id]: '' }))
  }

  function beginEditIncidentNote(incidentId, note) {
    setEditingNote({
      incidentId,
      incidentType: note.incidentType || '',
      noteId: note.id,
      text: String(note.text || ''),
    })
  }

  async function saveEditedIncidentNote() {
    if (!editingNote) return
    if (editingNote.incidentType === 'Safeguarding' && !canViewSafeguarding) return

    const text = String(editingNote.text || '').trim()
    if (!text) return

    const editedAt = new Date().toISOString()
    const { incidentId, noteId } = editingNote

    await setIncidents(prev => prev.map(inc => {
      if (inc.id !== incidentId) return inc

      const updatedNotes = incidentNotesForIncident(inc).map(note => (
        note.id === noteId && !note.deletedAt
          ? {
              ...note,
              text,
              updatedAt: editedAt,
              updatedBy: actorInitials,
            }
          : note
      ))

      return {
        ...inc,
        incidentNotes: updatedNotes,
        updatedByInitials: actorInitials,
        updatedByUserId: actorUserId || inc.updatedByUserId || null,
      }
    }))

    setEditingNote(null)
  }

  async function uploadIncidentDocument(incident, file) {
    if (!canAccessIncidentUpdates(incident, canViewSafeguarding)) return
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      alert('File must be under 8MB.')
      return
    }

    setUploadingExtraIncidentId(incident.id)
    try {
      const url = await uploadDocumentFile(file)
      const uploadedAt = new Date().toISOString()

      await setIncidents(prev => prev.map(inc => (
        inc.id === incident.id
          ? {
              ...inc,
              incidentDocuments: [
                ...incidentDocumentsForIncident(inc),
                {
                  id: crypto.randomUUID(),
                  name: file.name,
                  url,
                  uploadedAt,
                  uploadedBy: actorInitials,
                },
              ],
              updatedByInitials: actorInitials,
              updatedByUserId: actorUserId || inc.updatedByUserId || null,
            }
          : inc
      )))
    } catch (error) {
      alert(error.message || 'Unable to upload document')
    } finally {
      setUploadingExtraIncidentId('')
    }
  }

  async function deleteIncidentNote(incident, noteId) {
    if (!canAccessIncidentUpdates(incident, canViewSafeguarding)) return
    if (!window.confirm('Delete this note? You can recover it later.')) return

    await setIncidents(prev => prev.map(inc => {
      if (inc.id !== incident.id) return inc
      return {
        ...inc,
        incidentNotes: incidentNotesForIncident(inc).map(note => (
          note.id === noteId
            ? {
                ...note,
                deletedAt: new Date().toISOString(),
                deletedBy: actorInitials,
              }
            : note
        )),
        updatedByInitials: actorInitials,
        updatedByUserId: actorUserId || inc.updatedByUserId || null,
      }
    }))

    if (editingNote?.incidentId === incident.id && editingNote?.noteId === noteId) {
      setEditingNote(null)
    }
  }

  async function deleteIncidentDocument(incident, docId) {
    if (!canAccessIncidentUpdates(incident, canViewSafeguarding)) return
    if (!window.confirm('Delete this document from the report updates list? You can recover it later.')) return

    await setIncidents(prev => prev.map(inc => {
      if (inc.id !== incident.id) return inc
      return {
        ...inc,
        incidentDocuments: incidentDocumentsForIncident(inc).map(doc => (
          doc.id === docId
            ? {
                ...doc,
                deletedAt: new Date().toISOString(),
                deletedBy: actorInitials,
              }
            : doc
        )),
        updatedByInitials: actorInitials,
        updatedByUserId: actorUserId || inc.updatedByUserId || null,
      }
    }))
  }

  async function recoverIncidentNote(incident, noteId) {
    if (!canAccessIncidentUpdates(incident, canViewSafeguarding)) return
    await setIncidents(prev => prev.map(inc => {
      if (inc.id !== incident.id) return inc
      return {
        ...inc,
        incidentNotes: incidentNotesForIncident(inc).map(note => (
          note.id === noteId
            ? { ...note, deletedAt: null, deletedBy: null }
            : note
        )),
        updatedByInitials: actorInitials,
        updatedByUserId: actorUserId || inc.updatedByUserId || null,
      }
    }))
  }

  async function recoverIncidentDocument(incident, docId) {
    if (!canAccessIncidentUpdates(incident, canViewSafeguarding)) return
    await setIncidents(prev => prev.map(inc => {
      if (inc.id !== incident.id) return inc
      return {
        ...inc,
        incidentDocuments: incidentDocumentsForIncident(inc).map(doc => (
          doc.id === docId
            ? { ...doc, deletedAt: null, deletedBy: null }
            : doc
        )),
        updatedByInitials: actorInitials,
        updatedByUserId: actorUserId || inc.updatedByUserId || null,
      }
    }))
  }

  const participantAttendance = attendance
    .filter(a => a.participantId === participantId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const participantIncidents = incidents
    .filter(i => i.participantId === participantId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const participantNoteHistory = participantNotesForParticipant(participant)
  const participantDocuments = participantDocumentsForParticipant(participant)
  const activeParticipantNotes = participantNoteHistory.filter(note => !note.deletedAt)
  const activeParticipantDocuments = participantDocuments.filter(doc => !doc.deletedAt)

  // Register notes (from Sign In/Out tab)
  const registerNote = participant.register_note || participant.registerNote || null
  const registerNoteHistory = Array.isArray(participant.note_history)
    ? participant.note_history
    : Array.isArray(participant.noteHistory)
      ? participant.noteHistory
      : []

  const hasMedical = participant.medicalType?.length > 0 || participant.medicalDetails
  const hasConsents = Boolean(
    participant.photoConsent
    || participant.otcConsent
    || (Array.isArray(participant.otcAllowedItems) && participant.otcAllowedItems.length > 0)
    || participant.otcNotes
  )
  const hasDietaryAllergy = Boolean(participant.dietaryType || participant.allergyDetails || participant.mealAdjustments)
  const hasSend = !!participant.sendNeeds

  function defaultSummaryForCategory(category) {
    if (!participant) return ''
    const key = String(category || '').toLowerCase()
    if (key === 'send') return String(participant.sendNeeds || '').trim()
    if (key === 'allergy') return String(participant.allergyDetails || '').trim()
    if (key === 'medical') return String(participant.medicalDetails || '').trim()
    if (key === 'notes') return String(participant.notes || '').trim()
    if (key === 'dietary') {
      return [participant.dietaryType, participant.mealAdjustments]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .join(' - ')
    }
    return ''
  }

  async function uploadDocumentFile(file) {
    const safeName = String(file?.name || 'attachment').replace(/\s+/g, '-')
    const filePath = `${crypto.randomUUID()}-${safeName}`
    const uploadTargets = [
      { bucket: 'documents', filePath: `participants/${filePath}` },
      { bucket: 'incidents', filePath },
    ]

    let lastError = null

    for (const target of uploadTargets) {
      const { error } = await supabase.storage.from(target.bucket).upload(target.filePath, file)
      if (error) {
        lastError = error
        if (/bucket not found/i.test(error.message || '')) continue
        throw error
      }

      const { data } = supabase.storage.from(target.bucket).getPublicUrl(target.filePath)
      return data?.publicUrl || ''
    }

    throw new Error(lastError?.message || 'No storage bucket available for participant uploads.')
  }

  function updateParticipantRecord(updater) {
    setParticipants(prev => prev.map(item => (
      item.id === participant.id ? updater(item) : item
    )))
  }

  function beginEditRegisterHistoryEntry(entry, historyIndex) {
    const activeFollowUp = String(participant?.register_note || participant?.registerNote || '').trim()
    setEditingRegisterHistoryEntry({
      historyIndex,
      originalNote: String(entry.note || ''),
      note: String(entry.note || ''),
      keepOnRegister: activeFollowUp === String(entry.note || '').trim(),
    })
  }

  function cancelEditRegisterHistoryEntry() {
    setEditingRegisterHistoryEntry(null)
  }

  function saveEditedRegisterHistoryEntry() {
    if (!editingRegisterHistoryEntry) return
    const nextNote = String(editingRegisterHistoryEntry.note || '').trim()
    if (!nextNote) return
    const previousEntry = registerNoteHistory[editingRegisterHistoryEntry.historyIndex]
    const previousNote = String(previousEntry?.note || editingRegisterHistoryEntry.originalNote || '').trim()

    updateParticipantRecord(current => {
      const existingHistory = Array.isArray(current.note_history)
        ? current.note_history
        : Array.isArray(current.noteHistory)
          ? current.noteHistory
          : []
      return {
        ...current,
        note_history: existingHistory.map((entry, index) => (
          index === editingRegisterHistoryEntry.historyIndex
            ? {
                ...entry,
                note: nextNote,
                updatedAt: new Date().toISOString(),
                updatedBy: actorInitials,
              }
            : entry
        )),
        register_note: editingRegisterHistoryEntry.keepOnRegister
          ? nextNote
          : String(current.register_note || current.registerNote || '').trim() === previousNote
            ? null
            : (current.register_note || current.registerNote || null),
      }
    })

    if (typeof setAttendance === 'function') {
      setAttendance(prev => prev.map(record => (
        record.participantId === participant.id
        && record.date === previousEntry?.date
        && String(record.exceptionNotes || record.exception_notes || '').trim() === previousNote
          ? { ...record, exceptionNotes: nextNote }
          : record
      )))
    }

    setEditingRegisterHistoryEntry(null)
  }

  function deleteRegisterHistoryEntry(historyIndex) {
    if (!window.confirm('Delete this saved register note?')) return
    const removedEntry = registerNoteHistory[historyIndex]
    const removedNote = String(removedEntry?.note || '').trim()

    updateParticipantRecord(current => {
      const existingHistory = Array.isArray(current.note_history)
        ? current.note_history
        : Array.isArray(current.noteHistory)
          ? current.noteHistory
          : []
      const activeFollowUp = String(current.register_note || current.registerNote || '').trim()
      return {
        ...current,
        note_history: existingHistory.filter((_, index) => index !== historyIndex),
        register_note: activeFollowUp === removedNote ? null : (current.register_note || current.registerNote || null),
      }
    })

    if (typeof setAttendance === 'function') {
      setAttendance(prev => prev.map(record => (
        record.participantId === participant.id
        && record.date === removedEntry?.date
        && String(record.exceptionNotes || record.exception_notes || '').trim() === removedNote
          ? { ...record, exceptionNotes: null }
          : record
      )))
    }

    if (editingRegisterHistoryEntry?.historyIndex === historyIndex) {
      setEditingRegisterHistoryEntry(null)
    }
  }

  function addParticipantNote() {
    const text = String(participantNoteDraft || '').trim()
    if (!text) return

    const createdAt = new Date().toISOString()
    const note = {
      id: crypto.randomUUID(),
      text,
      createdAt,
      createdBy: actorInitials,
      updatedAt: null,
      updatedBy: null,
    }

    updateParticipantRecord(current => ({
      ...current,
      participantNotesHistory: [...participantNotesForParticipant(current), note],
    }))

    setParticipantNoteDraft('')
  }

  function beginEditParticipantNote(note) {
    setEditingParticipantNote({ noteId: note.id, text: String(note.text || '') })
  }

  function saveEditedParticipantNote() {
    if (!editingParticipantNote) return
    const text = String(editingParticipantNote.text || '').trim()
    if (!text) return

    const editedAt = new Date().toISOString()

    updateParticipantRecord(current => ({
      ...current,
      participantNotesHistory: participantNotesForParticipant(current).map(note => (
        note.id === editingParticipantNote.noteId && !note.deletedAt
          ? {
              ...note,
              text,
              updatedAt: editedAt,
              updatedBy: actorInitials,
            }
          : note
      )),
    }))

    setEditingParticipantNote(null)
  }

  function deleteParticipantNote(noteId) {
    if (!window.confirm('Delete this participant note? You can recover it later.')) return

    updateParticipantRecord(current => ({
      ...current,
      participantNotesHistory: participantNotesForParticipant(current).map(note => (
        note.id === noteId
          ? {
              ...note,
              deletedAt: new Date().toISOString(),
              deletedBy: actorInitials,
            }
          : note
      )),
    }))

    if (editingParticipantNote?.noteId === noteId) {
      setEditingParticipantNote(null)
    }
  }

  async function uploadParticipantDocument(file) {
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      alert('File must be under 8MB.')
      return
    }

    setUploadingParticipantDocument(true)
    try {
      const url = await uploadDocumentFile(file)
      const uploadedAt = new Date().toISOString()
      const doc = {
        id: crypto.randomUUID(),
        name: file.name,
        url,
        uploadedAt,
        uploadedBy: actorInitials,
      }

      updateParticipantRecord(current => ({
        ...current,
        participantDocuments: [...participantDocumentsForParticipant(current), doc],
      }))
    } catch (error) {
      alert(error.message || 'Unable to upload participant document')
    } finally {
      setUploadingParticipantDocument(false)
    }
  }

  function deleteParticipantDocument(docId) {
    if (!window.confirm('Delete this participant document? You can recover it later.')) return

    updateParticipantRecord(current => ({
      ...current,
      participantDocuments: participantDocumentsForParticipant(current).map(doc => (
        doc.id === docId
          ? {
              ...doc,
              deletedAt: new Date().toISOString(),
              deletedBy: actorInitials,
            }
          : doc
      )),
    }))
  }

  function recoverParticipantNote(noteId) {
    updateParticipantRecord(current => ({
      ...current,
      participantNotesHistory: participantNotesForParticipant(current).map(note => (
        note.id === noteId
          ? { ...note, deletedAt: null, deletedBy: null }
          : note
      )),
    }))
  }

  function recoverParticipantDocument(docId) {
    updateParticipantRecord(current => ({
      ...current,
      participantDocuments: participantDocumentsForParticipant(current).map(doc => (
        doc.id === docId
          ? { ...doc, deletedAt: null, deletedBy: null }
          : doc
      )),
    }))
  }

  async function withAccessToken() {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) {
      throw new Error('No active auth session')
    }
    return data.session.access_token
  }

  async function loadShareUsers() {
    if (!canManageShares) return

    try {
      const token = await withAccessToken()
      const response = await fetch('/api/admin-users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load staff users')

      const users = Array.isArray(payload.users)
        ? payload.users.filter(user => !user.isArchived)
        : []

      setShareUsers(users)
      if (shareTargetUserIds.length === 0 && users.length > 0) {
        setShareTargetUserIds([users[0].id])
      }
    } catch (error) {
      setShareError(error.message || 'Unable to load staff users')
    }
  }

  async function loadParticipantShares() {
    if (!canManageShares || !participant?.id) return
    setShareLoading(true)
    setShareError('')
    try {
      const { data, error } = await supabase
        .from('participant_staff_shares')
        .select('id, target_user_id, category, summary, created_at, status')
        .eq('participant_id', participant.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      setShareItems(Array.isArray(data) ? data : [])
    } catch (error) {
      setShareError(error.message || 'Unable to load shared entries')
      setShareItems([])
    } finally {
      setShareLoading(false)
    }
  }

  async function createShareItem() {
    if (shareTargetUserIds.length === 0) {
      setShareError('Choose at least one staff account.')
      return
    }
    if (shareCategories.length === 0) {
      setShareError('Choose at least one info type.')
      return
    }

    setShareSaving(true)
    setShareError('')
    try {
      const baseSummary = String(shareSummary || '').trim()
      const rows = []

      for (const targetUserId of shareTargetUserIds) {
        for (const category of shareCategories) {
          const resolvedSummary = baseSummary || defaultSummaryForCategory(category)
          if (!resolvedSummary) continue

          rows.push({
            participant_id: participantId,
            target_user_id: targetUserId,
            category,
            summary: resolvedSummary,
            status: 'active',
          })
        }
      }

      if (rows.length === 0) {
        setShareError('No shareable details found for selected categories. Add text or fill participant details first.')
        setShareSaving(false)
        return
      }

      const { error } = await supabase
        .from('participant_staff_shares')
        .insert(rows)
      if (error) throw error

      setShareSummary('')
      await loadParticipantShares()
    } catch (error) {
      setShareError(error.message || 'Unable to share info')
    } finally {
      setShareSaving(false)
    }
  }

  async function removeShareItem(shareId) {
    setShareError('')
    try {
      const { error } = await supabase
        .from('participant_staff_shares')
        .update({ status: 'archived' })
        .eq('id', shareId)
      if (error) throw error
      await loadParticipantShares()
    } catch (error) {
      setShareError(error.message || 'Unable to remove shared item')
    }
  }

  useEffect(() => {
    if (!canManageShares || !participantId) return
    loadShareUsers()
    loadParticipantShares()
  }, [canManageShares, participantId])

  useEffect(() => {
    if (activeTab !== 'Medical' || !participantId) return
    setLoadingMedical(true)
    Promise.all([
      supabase.from('medication_forms').select('*').eq('participant_id', participantId).order('created_at', { ascending: false }),
      supabase.from('medication_administration').select('*').eq('participant_id', participantId).order('administered_at', { ascending: false }),
      supabase.from('medication_plans').select('*').eq('participant_id', participantId).order('created_at', { ascending: false }),
    ]).then(([formsRes, adminRes, plansRes]) => {
      if (!formsRes.error) setMedicationForms(formsRes.data || [])
      if (!adminRes.error) setMedicationAdministration(adminRes.data || [])
      if (!plansRes.error) setMedicationPlans(plansRes.data || [])
    }).catch(err => {
      console.error('Medical data load error:', err)
    }).finally(() => {
      setLoadingMedical(false)
    })
  }, [activeTab, participantId])

  useEffect(() => {
    if (!canManageShares || !participant) return
    if (String(shareSummary || '').trim()) return
    if (shareCategories.length !== 1) return
    setShareSummary(defaultSummaryForCategory(shareCategories[0]))
  }, [canManageShares, shareCategories, participantId, participant?.sendNeeds, participant?.allergyDetails, participant?.medicalDetails, participant?.dietaryType, participant?.mealAdjustments])

  function toggleShareCategory(category) {
    setShareCategories(prev => (
      prev.includes(category)
        ? prev.filter(value => value !== category)
        : [...prev, category]
    ))
  }

  function toggleShareTargetUser(userId) {
    setShareTargetUserIds(prev => (
      prev.includes(userId)
        ? prev.filter(value => value !== userId)
        : [...prev, userId]
    ))
  }

  if (!participant) return (
    <div className="fade-in">
      <button onClick={onBack} className="btn-secondary flex items-center gap-2 mb-4">
        <ArrowLeft size={15} /> Back
      </button>
      <p className="text-stone-500">Participant not found.</p>
    </div>
  )

  if (editing) {
    return (
      <div className="fade-in space-y-4">
        <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={15} /> Cancel Edit
        </button>
        <ParticipantForm initial={participant} participants={participants} onSave={saveEdit} onCancel={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <button onClick={onBack} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={15} /> Back
        </button>
        <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-2">
          <Edit2 size={14} /> Edit
        </button>
      </div>

      {/* Profile card */}
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-forest-900 flex items-center justify-center text-white font-display font-bold text-xl flex-shrink-0">
            {participant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-forest-950"><ParticipantNameText participant={participant} className="font-display font-bold text-forest-950" /></h2>
            <p className="text-stone-500 text-sm">
              {[participant.pronouns, participant.age ? `Age ${participant.age}` : null, participant.role].filter(Boolean).join(' · ')}
            </p>
            {participant.dressingRoom && (
              <p className="text-xs text-stone-400 mt-0.5">Dressing Room: {participant.dressingRoom}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {participant.medicalType?.includes('Allergy') && (
            <span 
              className="badge-allergy cursor-help" 
              title={participant.allergyDetails || 'Allergy recorded (no details specified)'}
            >
              ⚠ Allergy
            </span>
          )}
          {participant.medicalType?.includes('Dietary') && <span className="badge-dietary">🍽 Dietary</span>}
          {participant.medicalType?.includes('Medical') && <span className="badge-medical">+ Medical</span>}
          {participant.sendNeeds && <span className="badge-send">★ SEND / Support</span>}
          {participant.safeguardingFlag && <SafeguardingFlagIcon className="px-2 py-0.5" size={12} />}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(tab => {
          const hasAlert =
            (tab === 'Medical' && hasMedical) ||
            (tab === 'SEND / Support' && hasSend) ||
            (tab === 'Incidents' && participantIncidents.length > 0)
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-display font-medium transition-all relative ${
                activeTab === tab
                  ? 'bg-forest-900 text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
              }`}
            >
              {tab}
              {hasAlert && activeTab !== tab && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-[#f5f3ef]" />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="fade-in" key={activeTab}>

        {/* OVERVIEW */}
        {activeTab === 'Overview' && (
          <div className="card space-y-4">
            <h3 className="font-display font-semibold text-forest-950 flex items-center gap-2">
              <User size={15} className="text-forest-600" /> Contact Details
            </h3>
            <div className="space-y-2 text-sm">
              {participant.parentName && <p className="font-medium text-forest-950">{participant.parentName}</p>}
              {participant.parentPhone && (
                <a href={`tel:${participant.parentPhone}`} className="flex items-center gap-2 text-forest-700 hover:underline">
                  <Phone size={13} /> {participant.parentPhone}
                </a>
              )}
              {participant.parentEmail && (
                <a href={`mailto:${participant.parentEmail}`} className="flex items-center gap-2 text-forest-700 hover:underline">
                  <Mail size={13} /> {participant.parentEmail}
                </a>
              )}
              {!participant.parentName && !participant.parentPhone && !participant.parentEmail && (
                <p className="text-stone-400 text-sm">No contact details recorded.</p>
              )}
            </div>

            {participant.approvedAdults && (
              <div className="pt-3 border-t border-stone-100">
                <p className="label mb-2">Approved Adults for Collection</p>
                <div className="space-y-1.5">
                  {participant.approvedAdults.split(',').map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-stone-700">
                      <span className="w-5 h-5 rounded-full bg-forest-100 text-forest-800 flex items-center justify-center text-xs font-bold font-display flex-shrink-0">
                        {i + 1}
                      </span>
                      {a.trim()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {participant.notes && (
              <div className="pt-3 border-t border-stone-100">
                <p className="label mb-1">Additional Notes</p>
                <p className="text-sm text-stone-700 leading-relaxed">{participant.notes}</p>
              </div>
            )}

            {hasConsents && (
              <div className="pt-3 border-t border-stone-100">
                <p className="label mb-2">Consents</p>
                <div className="space-y-1.5 text-sm text-stone-700">
                  {participant.photoConsent && <p>Photo consent: <span className="font-medium">{participant.photoConsent}</span></p>}
                  <p>OTC meds consent: <span className="font-medium">{participant.otcConsent ? 'Yes' : 'No / not set'}</span></p>
                  {Array.isArray(participant.otcAllowedItems) && participant.otcAllowedItems.length > 0 && (
                    <p>OTC allowed: <span className="font-medium">{participant.otcAllowedItems.join(', ')}</span></p>
                  )}
                  {participant.otcNotes && <p className="text-stone-600">{participant.otcNotes}</p>}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-stone-100 space-y-4">
              <div className="space-y-2">
                <h4 className="font-display font-semibold text-forest-900 flex items-center gap-2">
                  <MessageSquare size={14} className="text-forest-600" /> Participant Notes
                </h4>
                {activeParticipantNotes.length > 0 && (
                  <p className="text-xs text-stone-500">{activeParticipantNotes.length} active note(s)</p>
                )}
                {participantNoteHistory.length === 0 ? (
                  <p className="text-xs text-stone-500">No participant notes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {participantNoteHistory.map(note => {
                      const isEditing = editingParticipantNote?.noteId === note.id
                      const isDeleted = Boolean(note.deletedAt)
                      return (
                        <div key={note.id} className={`rounded-lg border px-3 py-2 ${isDeleted ? 'border-stone-200 bg-stone-100 opacity-75' : 'border-stone-200 bg-stone-50'}`}>
                          {isEditing && !isDeleted ? (
                            <div className="space-y-2">
                              <textarea
                                className="input min-h-[84px]"
                                value={editingParticipantNote?.text || ''}
                                onChange={e => setEditingParticipantNote(prev => prev ? { ...prev, text: e.target.value } : prev)}
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={saveEditedParticipantNote}
                                  className="text-xs px-2 py-1 rounded-md border border-emerald-200 text-emerald-800 hover:text-emerald-900 hover:border-emerald-300 bg-white inline-flex items-center gap-1"
                                >
                                  <Check size={13} /> Save Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingParticipantNote(null)}
                                  className="text-xs px-2 py-1 rounded-md border border-stone-200 text-stone-700 hover:text-stone-900 hover:border-stone-300 bg-white inline-flex items-center gap-1"
                                >
                                  <X size={13} /> Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className={`text-sm whitespace-pre-wrap ${isDeleted ? 'text-stone-500 line-through' : 'text-stone-800'}`}>{note.text}</p>
                              <div className="mt-1 flex items-center gap-3 text-[11px] text-stone-500 flex-wrap">
                                <span>
                                  Added {new Date(note.createdAt).toLocaleDateString('en-GB', {
                                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                  {note.createdBy ? ` by ${note.createdBy}` : ''}
                                </span>
                                {note.updatedAt && (
                                  <span>
                                    Edited {new Date(note.updatedAt).toLocaleDateString('en-GB', {
                                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                    {note.updatedBy ? ` by ${note.updatedBy}` : ''}
                                  </span>
                                )}
                                {!isDeleted && (
                                  <button
                                    type="button"
                                    onClick={() => beginEditParticipantNote(note)}
                                    className="underline text-forest-700 hover:text-forest-900"
                                  >
                                    Edit note
                                  </button>
                                )}
                                {!isDeleted && (
                                  <button
                                    type="button"
                                    onClick={() => deleteParticipantNote(note.id)}
                                    className="underline text-red-700 hover:text-red-900"
                                  >
                                    Delete note
                                  </button>
                                )}
                                {isDeleted && (
                                  <button
                                    type="button"
                                    onClick={() => recoverParticipantNote(note.id)}
                                    className="underline text-emerald-700 hover:text-emerald-900"
                                  >
                                    Recover
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 space-y-2">
                  <label className="text-xs font-semibold text-sky-900">Add participant note</label>
                  <textarea
                    className="input min-h-[84px]"
                    placeholder="Add participant update notes here..."
                    value={participantNoteDraft}
                    onChange={(e) => setParticipantNoteDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={addParticipantNote}
                    className="text-xs px-2 py-1 rounded-md border border-sky-200 text-sky-800 hover:text-sky-900 hover:border-sky-300 bg-white"
                  >
                    Add Note
                  </button>
                </div>
              </div>

              {/* Register Notes — from Sign In/Out */}
              {(registerNote || registerNoteHistory.length > 0) && (
                <div className="space-y-2">
                  <h4 className="font-display font-semibold text-forest-900 flex items-center gap-2">
                    <FileText size={14} className="text-amber-600" /> Register Notes
                    <span className="text-xs font-normal text-stone-400">(from Sign In / Out)</span>
                  </h4>
                  {registerNote && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <span className="text-amber-500 shrink-0 mt-0.5">!</span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-700 mb-0.5">Active register follow-up</p>
                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{registerNote}</p>
                      </div>
                    </div>
                  )}
                  {registerNoteHistory.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Session Note History</p>
                      {[...registerNoteHistory].reverse().map((entry, i) => {
                        const historyIndex = registerNoteHistory.length - 1 - i
                        const isEditingEntry = editingRegisterHistoryEntry?.historyIndex === historyIndex
                        return (
                          <div key={entry.id || `${entry.savedAt || entry.date || 'note'}-${historyIndex}`} className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                            {isEditingEntry ? (
                              <div className="space-y-2">
                                <textarea
                                  className="input min-h-[88px]"
                                  value={editingRegisterHistoryEntry.note}
                                  onChange={e => setEditingRegisterHistoryEntry(prev => ({ ...prev, note: e.target.value }))}
                                />
                                <label className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editingRegisterHistoryEntry.keepOnRegister}
                                    onChange={e => setEditingRegisterHistoryEntry(prev => ({ ...prev, keepOnRegister: e.target.checked }))}
                                    className="mt-0.5 h-4 w-4 rounded border-stone-300 text-forest-900 cursor-pointer"
                                  />
                                  <span className="text-xs text-stone-600">Pin for follow up</span>
                                </label>
                                <div className="flex items-center justify-end gap-2">
                                  <button type="button" onClick={saveEditedRegisterHistoryEntry} className="text-xs font-semibold text-forest-800 hover:text-forest-950 inline-flex items-center gap-1">
                                    <Check size={13} /> Save
                                  </button>
                                  <button type="button" onClick={cancelEditRegisterHistoryEntry} className="text-xs font-semibold text-stone-500 hover:text-stone-800 inline-flex items-center gap-1">
                                    <X size={13} /> Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm text-stone-800 whitespace-pre-wrap flex-1">{entry.note}</p>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button type="button" onClick={() => beginEditRegisterHistoryEntry(entry, historyIndex)} className="text-stone-400 hover:text-forest-700" title="Edit saved note">
                                      <Edit2 size={14} />
                                    </button>
                                    <button type="button" onClick={() => deleteRegisterHistoryEntry(historyIndex)} className="text-stone-400 hover:text-red-600" title="Delete saved note">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[11px] text-stone-400 mt-1">
                                  {entry.date ? new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                                  {entry.addedBy ? ` · ${entry.addedBy}` : ''}
                                </p>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-display font-semibold text-forest-900 flex items-center gap-2">
                  <Paperclip size={14} className="text-forest-600" /> Participant Documents
                </h4>
                {activeParticipantDocuments.length > 0 && (
                  <p className="text-xs text-stone-500">{activeParticipantDocuments.length} active document(s)</p>
                )}
                {participantDocuments.length === 0 ? (
                  <p className="text-xs text-stone-500">No participant documents uploaded.</p>
                ) : (
                  <div className="space-y-1">
                    {participantDocuments.map(doc => (
                      <div key={doc.id} className="text-xs text-stone-700 flex items-center gap-2 flex-wrap">
                        {doc.deletedAt ? (
                          <span className="text-stone-500 line-through">{doc.name}</span>
                        ) : (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="underline text-forest-700 hover:text-forest-900">{doc.name}</a>
                        )}
                        <span className="text-stone-500">
                          Added {new Date(doc.uploadedAt).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                          {doc.uploadedBy ? ` by ${doc.uploadedBy}` : ''}
                        </span>
                        {!doc.deletedAt && (
                          <button
                            type="button"
                            onClick={() => deleteParticipantDocument(doc.id)}
                            className="underline text-red-700 hover:text-red-900"
                          >
                            Delete
                          </button>
                        )}
                        {doc.deletedAt && (
                          <button
                            type="button"
                            onClick={() => recoverParticipantDocument(doc.id)}
                            className="underline text-emerald-700 hover:text-emerald-900"
                          >
                            Recover
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3">
                  <label className="text-xs font-semibold text-indigo-900 block mb-2">Upload participant document</label>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      uploadParticipantDocument(file)
                      e.target.value = ''
                    }}
                    className="block w-full text-xs text-stone-700"
                  />
                  {uploadingParticipantDocument && (
                    <p className="mt-2 text-xs text-indigo-800">Uploading document...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MEDICAL */}
        {activeTab === 'Medical' && (
          <div className="space-y-4">
            <div className="card">
            <h3 className="font-display font-semibold text-forest-950 mb-4">Medical, Allergy & Dietary</h3>
            {hasMedical ? (
  <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      {participant.medicalType?.map(t => (
        <span key={t} className={
          t === 'Allergy' ? 'badge-allergy text-sm px-3 py-1' :
          t === 'Dietary' ? 'badge-dietary text-sm px-3 py-1' :
          t === 'Medical' ? 'badge-medical text-sm px-3 py-1' :
          'text-sm px-3 py-1'
        }>{t}</span>
      ))}
    </div>
    {participant.medicalDetails && (
      <div className="bg-stone-50 rounded-xl p-4 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
        {participant.medicalDetails}
      </div>
    )}
    {hasDietaryAllergy && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {participant.dietaryType && (
          <div className="bg-stone-50 rounded-xl p-3 text-sm text-stone-700">
            <p className="label mb-1">Dietary Type</p>
            <p>{participant.dietaryType}</p>
          </div>
        )}
                    {participant.mealAdjustments && (
                      <div className="bg-stone-50 rounded-xl p-3 text-sm text-stone-700">
                        <p className="label mb-1">Dietary Details</p>
                        <p>{participant.mealAdjustments}</p>
                      </div>
                    )}
                    {participant.allergyDetails && (
                      <div className="bg-stone-50 rounded-xl p-3 text-sm text-stone-700 sm:col-span-2">
                        <p className="label mb-1">Allergy Details</p>
                        <p className="whitespace-pre-wrap">{participant.allergyDetails}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-stone-400 text-sm">No medical, allergy, or dietary requirements recorded.</p>
                <button onClick={() => setEditing(true)} className="mt-3 text-xs text-forest-600 hover:underline">
                  Add via Edit →
                </button>
              </div>
            )}
            </div>

            {/* Medication Plans */}
            {loadingMedical ? (
              <div className="card"><p className="text-sm text-stone-500">Loading medical records...</p></div>
            ) : (
              <>
                {medicationPlans.length > 0 && (
                  <div className="card space-y-2">
                    <h4 className="font-display font-semibold text-forest-950">Medication Plans</h4>
                    {medicationPlans.map(plan => (
                      <div key={plan.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                        <p className="font-medium text-forest-950">{plan.medication_name}</p>
                        {plan.dose && <p className="text-xs text-stone-500">Dose: {plan.dose}</p>}
                        {plan.instructions && <p className="text-xs text-stone-600 mt-1">{plan.instructions}</p>}
                        {plan.valid_until && (
                          <p className="text-xs text-stone-400 mt-1">Valid until {new Date(`${plan.valid_until}T12:00:00`).toLocaleDateString('en-GB')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Medical Forms */}
                <div className="card space-y-2">
                  <h4 className="font-display font-semibold text-forest-950">Medical Forms</h4>
                  {medicationForms.length === 0 ? (
                    <p className="text-xs text-stone-500">No medical forms uploaded yet. Upload via the Medical tab.</p>
                  ) : (
                    <div className="space-y-2">
                      {medicationForms.map(form => (
                        <div key={form.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3">
                          <div>
                            <p className="text-sm font-medium text-forest-950">{form.form_name}</p>
                            <p className="text-xs text-stone-500">
                              Uploaded {new Date(form.created_at).toLocaleDateString('en-GB')}
                              {form.valid_until ? ` · Valid until ${new Date(`${form.valid_until}T12:00:00`).toLocaleDateString('en-GB')}` : ''}
                              {form.uploaded_by_initials ? ` · ${form.uploaded_by_initials}` : ''}
                            </p>
                            {form.notes && <p className="text-xs text-stone-400 mt-0.5">{form.notes}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.storage.from('documents').download(form.storage_path)
                                if (error) throw error
                                const url = URL.createObjectURL(data)
                                const opened = window.open(url, '_blank', 'noopener,noreferrer')
                                if (!opened) URL.revokeObjectURL(url)
                                else setTimeout(() => URL.revokeObjectURL(url), 60_000)
                              } catch (err) {
                                alert(`Could not open form: ${err.message}`)
                              }
                            }}
                            className="btn-secondary text-xs"
                          >
                            Open
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* MAR Log */}
                <div className="card space-y-2">
                  <h4 className="font-display font-semibold text-forest-950">Medication Administration Log (MAR)</h4>
                  {medicationAdministration.length === 0 ? (
                    <p className="text-xs text-stone-500">No MAR entries recorded for this child yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {medicationAdministration.map(row => {
                        const when = row.administered_at ? new Date(row.administered_at).toLocaleString('en-GB') : '—'
                        const medName = row.medication_name || medicationForms.find(f => f.id === row.medication_form_id)?.form_name || medicationPlans.find(p => p.id === row.medication_plan_id)?.medication_name || '—'
                        const isAdHoc = !row.medication_form_id && !row.medication_plan_id
                        return (
                          <div key={row.id} className={`rounded-xl border p-3 text-sm ${isAdHoc ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-forest-950">{medName}</span>
                                {row.dose_given && <span className="text-stone-500">· {row.dose_given}</span>}
                                <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                                  row.status === 'given' ? 'bg-green-100 text-green-700' :
                                  row.status === 'refused' ? 'bg-red-100 text-red-700' :
                                  'bg-stone-100 text-stone-600'
                                }`}>{row.status}</span>
                                {isAdHoc && (
                                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Ad-hoc · Follow Up</span>
                                )}
                              </div>
                              <span className="text-xs text-stone-400">{when} · {row.staff_initials}</span>
                            </div>
                            {row.notes && <p className="text-xs text-stone-500 mt-1">{row.notes}</p>}
                            <p className={`text-xs mt-1 ${row.parent_notified ? 'text-green-700 font-medium' : 'text-stone-400'}`}>
                              {row.parent_notified
                                ? `Parent notified${row.parent_notified_at ? ` at ${new Date(row.parent_notified_at).toLocaleString('en-GB')}` : ''}${row.parent_notification_method ? ` via ${row.parent_notification_method}` : ''}`
                                : 'Parent not yet notified'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* SEND */}
        {activeTab === 'SEND / Support' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-forest-950">SEND & Support Needs</h3>
              {participant.sendDiagnosed && (
                <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
                  Formally Diagnosed
                </span>
              )}
            </div>
            {hasSend ? (
              <div className="space-y-4">
                {participant.sendDiagnosed && canViewSendDiagnosis && participant.sendDiagnosis && (
                  <div className="bg-red-50 rounded-xl p-4 text-sm text-red-900 border border-red-200">
                    <p className="font-semibold mb-1">Diagnosis</p>
                    <p>{participant.sendDiagnosis}</p>
                  </div>
                )}
                <div className="bg-purple-50 rounded-xl p-4 text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">
                  {participant.sendNeeds}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-stone-400 text-sm">No SEND or support needs recorded.</p>
                <button onClick={() => setEditing(true)} className="mt-3 text-xs text-forest-600 hover:underline">
                  Add via Edit →
                </button>
              </div>
            )}
          </div>
        )}

        {canManageShares && activeTab === 'Overview' && (
          <div className="card mt-4 space-y-3">
            <div>
              <h3 className="font-display font-semibold text-forest-950 flex items-center gap-2">
                <Share2 size={15} className="text-forest-600" /> Share With Specific Staff
              </h3>
              <p className="text-xs text-stone-500 mt-1">Share only targeted SEND/Allergy/Medical/Dietary information with selected staff accounts.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Info Type(s)</label>
                <div className="rounded-xl border border-stone-200 p-2 space-y-1.5">
                  {['send', 'allergy', 'medical', 'dietary', 'notes'].map(category => (
                    <label key={category} className="inline-flex items-center gap-2 text-sm text-forest-900 mr-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={shareCategories.includes(category)}
                        onChange={() => toggleShareCategory(category)}
                      />
                      {category === 'send' ? 'SEND' : category === 'notes' ? 'Additional Notes' : category[0].toUpperCase() + category.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Share To Staff Login(s)</label>
                <div className="rounded-xl border border-stone-200 p-2 max-h-40 overflow-y-auto space-y-1.5">
                  {shareUsers.length === 0 ? (
                    <p className="text-xs text-stone-500">No staff users available.</p>
                  ) : shareUsers.map(user => (
                    <label key={user.id} className="inline-flex items-center gap-2 text-sm text-forest-900 w-full">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={shareTargetUserIds.includes(user.id)}
                        onChange={() => toggleShareTargetUser(user.id)}
                      />
                      {user.fullName}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="label">Info To Share (optional override)</label>
              <textarea
                className="input min-h-[96px]"
                value={shareSummary}
                onChange={e => setShareSummary(e.target.value)}
                placeholder="Leave blank to use participant details for each selected type, or add custom text to apply to all selected shares."
              />
            </div>

            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={createShareItem} disabled={shareSaving}>
                {shareSaving ? 'Sharing...' : 'Share With Staff'}
              </button>
            </div>

            {shareError && <p className="text-sm text-red-700">{shareError}</p>}

            <div className="space-y-2 border-t border-stone-100 pt-3">
              <p className="label">Currently Shared</p>
              {shareLoading ? (
                <p className="text-xs text-stone-500">Loading shares...</p>
              ) : shareItems.length === 0 ? (
                <p className="text-xs text-stone-500">Nothing shared yet for this participant.</p>
              ) : shareItems.map(item => {
                const user = shareUsers.find(candidate => candidate.id === item.target_user_id)
                return (
                  <div key={item.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-forest-900">{String(item.category || '').toUpperCase()} to {user?.email || item.target_user_id}</p>
                      <button
                        type="button"
                        onClick={() => removeShareItem(item.id)}
                        className="text-stone-400 hover:text-red-600"
                        title="Remove from staff list"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-stone-700 whitespace-pre-wrap">{item.summary}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ATTENDANCE */}
        {activeTab === 'Attendance' && (
          <div className="card">
            <h3 className="font-display font-semibold text-forest-950 mb-4 flex items-center gap-2">
              <Clock size={15} className="text-forest-600" /> Attendance History
            </h3>
            {participantAttendance.length === 0 ? (
              <p className="text-stone-400 text-sm text-center py-6">No attendance recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide border-b border-stone-100">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">In</th>
                      <th className="pb-2 pr-4">Out</th>
                      <th className="pb-2 pr-4">Duration</th>
                      <th className="pb-2">Collected by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {participantAttendance.map(a => {
                      const duration = a.signIn && a.signOut
                        ? Math.round((new Date(a.signOut) - new Date(a.signIn)) / 60000)
                        : null
                      return (
                        <tr key={a.id}>
                          <td className="py-2.5 pr-4 font-medium text-forest-950 whitespace-nowrap">
                            {new Date(a.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </td>
                          <td className="py-2.5 pr-4 text-green-700 whitespace-nowrap">{fmt(a.signIn)}</td>
                          <td className="py-2.5 pr-4 text-blue-700 whitespace-nowrap">{fmt(a.signOut)}</td>
                          <td className="py-2.5 pr-4 text-stone-500 whitespace-nowrap">
                            {duration
                              ? `${Math.floor(duration / 60)}h ${duration % 60}m`
                              : a.signIn ? <span className="text-amber-600">On site</span> : '—'}
                          </td>
                          <td className="py-2.5 text-stone-600 text-xs">
                            {a.collectedBy || <span className="text-stone-300">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* INCIDENTS */}
        {activeTab === 'Incidents' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-forest-950 flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-500" /> Incidents & Accidents
                </h3>
                {canViewSafeguarding && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    Safeguarding Access Enabled
                  </p>
                )}
              </div>
              <button onClick={() => setShowIncident(s => !s)} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
                {showIncident ? 'Close Form' : '+ Log Incident'}
              </button>
            </div>

            {saveNotice && (
              <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex flex-wrap items-center gap-2">
                <span>{saveNotice}</span>
                <button
                  type="button"
                  className="ml-auto text-xs font-semibold underline"
                  onClick={() => onNavigate?.('signin')}
                >
                  Go to Sign In/Out
                </button>
              </div>
            )}

            {showIncident && (
              <IncidentForm
                participantId={participant.id}
                participantName={participant.name || ''}
                participantAge={participant.age || ''}
                defaultStaffMember={currentStaffName}
                initial={editingIncident}
                canEditSafeguarding={!editingIncident || canEditSafeguardingIncident(editingIncident)}
                staffList={staffList}
                onSave={saveIncident}
                onCancel={() => {
                  setShowIncident(false)
                  setEditingIncidentId(null)
                }}
              />
            )}

            {participantIncidents.length === 0 ? (
              <p className="text-stone-400 text-sm text-center py-6">No incidents recorded.</p>
            ) : (
              <div className="space-y-3">
                {participantIncidents.map(inc => {
                  const createdTime = new Date(inc.createdAt).getTime()
                  const updatedRaw = inc.updatedAt || inc.updated_at || null
                  const updatedTime = updatedRaw ? new Date(updatedRaw).getTime() : 0
                  const isEdited = Boolean(updatedRaw) && updatedTime - createdTime > 1000
                  const createdByInitials = inc.createdByInitials || inc.created_by_initials || null
                  const updatedByInitials = inc.updatedByInitials || inc.updated_by_initials || null
                  const canEditSafeguarding = canEditSafeguardingIncident(inc)
                  const isDownloadingReport = downloadingIncidentId === inc.id
                  const incidentNotes = incidentNotesForIncident(inc)
                  const incidentDocuments = incidentDocumentsForIncident(inc)
                  const activeIncidentNotes = incidentNotes.filter(note => !note.deletedAt)
                  const activeIncidentDocuments = incidentDocuments.filter(doc => !doc.deletedAt)
                  const isUpdatesAllowed = canAccessIncidentUpdates(inc, canViewSafeguarding)
                  const isUpdatesOpen = isUpdatesAllowed && expandedIncidentId === inc.id
                  const noteDraft = noteDraftByIncident[inc.id] || ''
                  const isUploadingExtra = uploadingExtraIncidentId === inc.id
                  return (
                  <div
                    key={inc.id}
                    className="border border-stone-100 rounded-xl p-4 cursor-pointer hover:border-forest-200"
                    onClick={() => openIncidentReport(inc)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          inc.severity === 'high' ? 'bg-red-100 text-red-700' :
                          inc.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {inc.severity?.toUpperCase()} — {inc.type}
                        </span>
                        {inc.followUpRequired && !inc.followUpCompletedAt && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Follow Up due</span>
                        )}
                        {inc.followUpCompletedAt && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Followed up</span>
                        )}
                        {resolvedAtForIncident(inc) && (
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Resolved</span>
                        )}
                        {isUpdatesAllowed && activeIncidentNotes.length > 0 && (
                          <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">{activeIncidentNotes.length} notes</span>
                        )}
                        {isUpdatesAllowed && activeIncidentDocuments.length > 0 && (
                          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">{activeIncidentDocuments.length} docs</span>
                        )}
                      </div>
                      <span className="text-xs text-stone-400">
                        {new Date(inc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {isEdited && (
                      <p className="text-xs text-forest-700 mb-2">
                        Updated {new Date(updatedRaw).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}{updatedByInitials ? ` by ${updatedByInitials}` : ''}
                      </p>
                    )}
                    {!isEdited && createdByInitials && (
                      <p className="text-xs text-stone-500 mb-2">Logged by {createdByInitials}</p>
                    )}
                    {resolvedAtForIncident(inc) && (
                      <p className="text-xs text-emerald-700 mb-2">
                        Resolved {new Date(resolvedAtForIncident(inc)).toLocaleDateString('en-GB')}{inc.resolvedBy ? ` by ${inc.resolvedBy}` : ''}
                      </p>
                    )}
                    <p className="text-sm text-stone-700 leading-relaxed">{inc.description}</p>
                    {inc.followUpRequired && (
                      <p className="text-xs text-stone-500 mt-2">
                        <strong>Follow Up:</strong>{' '}
                        {inc.followUpCompletedAt
                          ? `Completed on ${new Date(inc.followUpCompletedAt).toLocaleDateString('en-GB')}`
                          : `Due on ${new Date(`${inc.followUpDueDate}T12:00:00`).toLocaleDateString('en-GB')}`}
                      </p>
                    )}
                    {inc.action && (
                      <p className="text-xs text-stone-500 mt-2">
                        <strong>Action taken:</strong> {inc.action}
                      </p>
                    )}
                    {inc.pdfName && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-forest-700">
                        <FileText size={12} />
                        <span>{inc.pdfName}</span>
                        {inc.type === 'Safeguarding' && !canViewSafeguarding ? (
                          <span className="ml-1 text-stone-500">Restricted</span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadIncidentReport(inc)
                            }}
                            className="ml-1 underline hover:text-forest-900"
                          >
                            {isDownloadingReport ? 'Downloading...' : 'Download'}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {isUpdatesAllowed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedIncidentId(prev => (prev === inc.id ? '' : inc.id))
                            setEditingNote(null)
                          }}
                          className="text-xs px-2 py-1 rounded-md border border-sky-200 text-sky-800 hover:text-sky-900 hover:border-sky-300 bg-white"
                        >
                          Updates
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditIncident(inc)
                        }}
                        className="text-xs text-forest-700 hover:text-forest-900 underline"
                        type="button"
                      >
                        {inc.type === 'Safeguarding' && !canEditSafeguarding
                          ? 'Safeguarding edit restricted'
                          : 'Edit submission'}
                      </button>
                      {inc.type === 'Safeguarding' && canViewSafeguarding && !isSafeguardingResolved(inc) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            markSafeguardingResolved(inc)
                          }}
                          className="text-xs px-2 py-1 rounded-md border border-emerald-200 text-emerald-800 hover:text-emerald-900 hover:border-emerald-300 bg-white"
                        >
                          Mark as Resolved
                        </button>
                      )}
                      {inc.type === 'Safeguarding' && canViewSafeguarding && isSafeguardingResolved(inc) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            reopenSafeguardingIncident(inc)
                          }}
                          className="text-xs px-2 py-1 rounded-md border border-amber-200 text-amber-800 hover:text-amber-900 hover:border-amber-300 bg-white"
                        >
                          Reopen
                        </button>
                      )}
                    </div>

                    {isUpdatesOpen && (
                      <div
                        className="mt-4 pt-4 border-t border-stone-200 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-forest-900">
                            <MessageSquare size={14} /> Notes & Updates
                          </div>
                          {incidentNotes.length === 0 ? (
                            <p className="text-xs text-stone-500">No notes yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {incidentNotes.map(note => {
                                const isEditingThisNote = editingNote?.incidentId === inc.id && editingNote?.noteId === note.id
                                const isDeleted = Boolean(note.deletedAt)
                                return (
                                  <div key={note.id} className={`rounded-lg border px-3 py-2 ${isDeleted ? 'border-stone-200 bg-stone-100 opacity-75' : 'border-stone-200 bg-stone-50'}`}>
                                    {isEditingThisNote && !isDeleted ? (
                                      <div className="space-y-2">
                                        <textarea
                                          className="input min-h-[84px]"
                                          value={editingNote?.text || ''}
                                          onChange={(e) => setEditingNote(prev => prev ? { ...prev, text: e.target.value } : prev)}
                                        />
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={saveEditedIncidentNote}
                                            className="text-xs px-2 py-1 rounded-md border border-emerald-200 text-emerald-800 hover:text-emerald-900 hover:border-emerald-300 bg-white inline-flex items-center gap-1"
                                          >
                                            <Check size={13} /> Save Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingNote(null)}
                                            className="text-xs px-2 py-1 rounded-md border border-stone-200 text-stone-700 hover:text-stone-900 hover:border-stone-300 bg-white inline-flex items-center gap-1"
                                          >
                                            <X size={13} /> Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <p className={`text-sm whitespace-pre-wrap ${isDeleted ? 'text-stone-500 line-through' : 'text-stone-800'}`}>{note.text}</p>
                                        <div className="mt-1 flex items-center gap-3 text-[11px] text-stone-500 flex-wrap">
                                          <span>
                                            Added {new Date(note.createdAt).toLocaleDateString('en-GB', {
                                              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                            {note.createdBy ? ` by ${note.createdBy}` : ''}
                                          </span>
                                          {note.updatedAt && (
                                            <span>
                                              Edited {new Date(note.updatedAt).toLocaleDateString('en-GB', {
                                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                              })}
                                              {note.updatedBy ? ` by ${note.updatedBy}` : ''}
                                            </span>
                                          )}
                                          {!isDeleted && (
                                            <button
                                              type="button"
                                              onClick={() => beginEditIncidentNote(inc.id, { ...note, incidentType: inc.type })}
                                              className="underline text-forest-700 hover:text-forest-900"
                                            >
                                              Edit note
                                            </button>
                                          )}
                                          {!isDeleted && (
                                            <button
                                              type="button"
                                              onClick={() => deleteIncidentNote(inc, note.id)}
                                              className="underline text-red-700 hover:text-red-900"
                                            >
                                              Delete note
                                            </button>
                                          )}
                                          {isDeleted && (
                                            <button
                                              type="button"
                                              onClick={() => recoverIncidentNote(inc, note.id)}
                                              className="underline text-emerald-700 hover:text-emerald-900"
                                            >
                                              Recover
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 space-y-2">
                            <label className="text-xs font-semibold text-sky-900">Add note</label>
                            <textarea
                              className="input min-h-[84px]"
                              placeholder="Add update details here..."
                              value={noteDraft}
                              onChange={(e) => setNoteDraftByIncident(prev => ({ ...prev, [inc.id]: e.target.value }))}
                            />
                            <button
                              type="button"
                              onClick={() => addIncidentNote(inc)}
                              className="text-xs px-2 py-1 rounded-md border border-sky-200 text-sky-800 hover:text-sky-900 hover:border-sky-300 bg-white"
                            >
                              Add Note
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-forest-900">
                            <Paperclip size={14} /> Additional Documents
                          </div>
                          {incidentDocuments.length === 0 ? (
                            <p className="text-xs text-stone-500">No additional documents yet.</p>
                          ) : (
                            <div className="space-y-1">
                              {incidentDocuments.map(doc => (
                                <div key={doc.id} className="text-xs text-stone-700 flex items-center gap-2 flex-wrap">
                                  {doc.deletedAt ? (
                                    <span className="text-stone-500 line-through">{doc.name}</span>
                                  ) : (
                                    <a href={doc.url} target="_blank" rel="noreferrer" className="underline text-forest-700 hover:text-forest-900">{doc.name}</a>
                                  )}
                                  <span className="text-stone-500">
                                    Added {new Date(doc.uploadedAt).toLocaleDateString('en-GB', {
                                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                    {doc.uploadedBy ? ` by ${doc.uploadedBy}` : ''}
                                  </span>
                                  {!doc.deletedAt && (
                                    <button
                                      type="button"
                                      onClick={() => deleteIncidentDocument(inc, doc.id)}
                                      className="underline text-red-700 hover:text-red-900"
                                    >
                                      Delete
                                    </button>
                                  )}
                                  {doc.deletedAt && (
                                    <button
                                      type="button"
                                      onClick={() => recoverIncidentDocument(inc, doc.id)}
                                      className="underline text-emerald-700 hover:text-emerald-900"
                                    >
                                      Recover
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3">
                            <label className="text-xs font-semibold text-indigo-900 block mb-2">Upload additional document</label>
                            <input
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                uploadIncidentDocument(inc, file)
                                e.target.value = ''
                              }}
                              className="block w-full text-xs text-stone-700"
                            />
                            {isUploadingExtra && (
                              <p className="mt-2 text-xs text-indigo-800">Uploading document...</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
