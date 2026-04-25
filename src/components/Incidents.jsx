import { useState } from 'react'
import { AlertTriangle, Plus, FileText, Search, ChevronRight, Trash2, Mail, Edit2, MessageSquare, Paperclip, Check, X } from 'lucide-react'
import IncidentForm from './IncidentForm'
import { supabase } from '../supabase'

const REPORT_TYPE_ORDER = ['Incident/Accident', 'Safeguarding', 'Mid-Camp Assessment', 'SEND Assessment']

function getNextDateKey(isoString) {
  const date = new Date(isoString)
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
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

export default function Incidents({ incidents, setIncidents, participants, setParticipants, attendance = [], setAttendance, staffList = [], actorInitials = 'ST', actorUserId = '', currentStaffName = '', canViewSafeguarding = false, canViewParticipant = false, onNavigate, onView }) {
  const [showForm, setShowForm] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState('')
  const [editingIncidentId, setEditingIncidentId] = useState(null)
  const [saveNotice, setSaveNotice] = useState('')
  const [reportSubTab, setReportSubTab] = useState('all')
  const [search, setSearch] = useState('')
  const [openingIncidentId, setOpeningIncidentId] = useState('')
  const [downloadingIncidentId, setDownloadingIncidentId] = useState('')
  const [expandedIncidentId, setExpandedIncidentId] = useState('')
  const [noteDraftByIncident, setNoteDraftByIncident] = useState({})
  const [editingNote, setEditingNote] = useState(null)
  const [uploadingExtraIncidentId, setUploadingExtraIncidentId] = useState('')

  const editingIncident = incidents.find(inc => inc.id === editingIncidentId) || null
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

  async function saveIncident(data) {
    if (!selectedParticipant) return

    if (editingIncident) {
      await setIncidents(prev => prev.map(inc => {
        if (inc.id !== editingIncident.id) return inc

        const timing = data.followUpTiming || (data.followUpRequired ? 'tomorrow' : 'none')
        const followUpRequired = timing !== 'none'
        const followUpDueDate = timing === 'tomorrow'
          ? (inc.followUpDueDate || getNextDateKey(inc.createdAt))
          : timing === 'today' ? getTodayKey() : null
        return {
          ...inc,
          ...data,
          updatedByInitials: actorInitials,
          updatedByUserId: actorUserId || inc.updatedByUserId || null,
          id: inc.id,
          participantId: inc.participantId,
          createdAt: inc.createdAt,
          followUpRequired,
          followUpTiming: timing,
          followUpDueDate,
          followUpCompletedAt: followUpRequired ? inc.followUpCompletedAt : null,
          followUpCompletedBy: followUpRequired ? inc.followUpCompletedBy : null,
        }
      }))
      setShowForm(false)
      setSelectedParticipant('')
      setEditingIncidentId(null)
      return
    }

    const createdAt = new Date().toISOString()
    const timing = data.followUpTiming || (data.followUpRequired ? 'tomorrow' : 'none')
    const followUpRequired = timing !== 'none'
    const followUpDueDate = timing === 'tomorrow' ? getNextDateKey(createdAt) : timing === 'today' ? getTodayKey() : null

    await setIncidents(prev => [
      ...prev,
      {
        ...data,
        id: data.id || crypto.randomUUID(),
        createdByInitials: actorInitials,
        updatedByInitials: actorInitials,
        createdByUserId: actorUserId || null,
        updatedByUserId: actorUserId || null,
        participantId: selectedParticipant,
        createdAt,
        followUpRequired,
        followUpTiming: timing,
        followUpDueDate,
        followUpCompletedAt: null,
        followUpCompletedBy: null,
        resolvedAt: null,
        resolvedBy: null,
        incidentNotes: [],
        incidentDocuments: [],
      },
    ])

    const participantName = participants.find(p => p.id === selectedParticipant)?.name || 'participant'

    const noticeDetail = timing === 'today'
      ? 'Follow up today flagged on sign in/out tab.'
      : timing === 'tomorrow'
      ? "Follow up flagged for tomorrow's register."
      : ''
    setSaveNotice(`Report saved for ${participantName}. ${noticeDetail}`.trim())
    setShowForm(false)
    setSelectedParticipant('')
  }

  function startEditIncident(inc) {
    if (!canEditSafeguardingIncident(inc)) {
      alert('Only authorised users or the original submitter can edit safeguarding submissions.')
      return
    }

    setSelectedParticipant(inc.participantId)
    setEditingIncidentId(inc.id)
    setShowForm(true)
  }

  function deleteIncident(id) {
    if (window.confirm('Delete this incident? This cannot be undone.')) {
      setIncidents(prev => prev.filter(inc => inc.id !== id))
    }
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

    if (typeof setParticipants !== 'function') return

    const hasOtherOpenSafeguarding = incidents.some(inc => (
      inc.id !== incident.id
      && inc.participantId === incident.participantId
      && inc.type === 'Safeguarding'
      && !isSafeguardingResolved(inc)
    ))

    if (!hasOtherOpenSafeguarding) {
      await setParticipants(prev => prev.map(p => (
        p.id === incident.participantId
          ? { ...p, safeguardingFlag: false }
          : p
      )))
    }
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

    if (typeof setParticipants !== 'function') return

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

  async function uploadDocumentFile(file) {
    const safeName = String(file?.name || 'attachment').replace(/\s+/g, '-')
    const filePath = `${crypto.randomUUID()}-${safeName}`
    const uploadTargets = [
      { bucket: 'documents', filePath: `incidents/${filePath}` },
    ]

    let lastError = null

    for (const target of uploadTargets) {
      const { error } = await supabase.storage.from(target.bucket).upload(target.filePath, file)

      if (error) {
        lastError = error
        const msg = error.message || ''
        const status = error.statusCode || error.status || ''
        if (
          /bucket not found/i.test(msg)
          || /not found/i.test(msg)
          || /does not exist/i.test(msg)
          || String(status) === '400'
          || String(status) === '404'
        ) continue
        throw error
      }

      const { data } = supabase.storage.from(target.bucket).getPublicUrl(target.filePath)
      return data?.publicUrl || ''
    }

    throw new Error(lastError?.message || 'No storage bucket available for incident uploads.')
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

  const filtered = incidents
    .filter(inc => {
      const p = participants.find(x => x.id === inc.participantId)
      return !search || p?.name.toLowerCase().includes(search.toLowerCase())
    })
    .filter(inc => reportSubTab === 'all' || inc.type === reportSubTab)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const groupedIncidents = filtered.reduce((groups, incident) => {
    const type = incident.type || 'Other'
    if (!groups[type]) groups[type] = []
    groups[type].push(incident)
    return groups
  }, {})

  const groupedTypes = Object.keys(groupedIncidents).sort((a, b) => {
    const aIndex = REPORT_TYPE_ORDER.indexOf(a)
    const bIndex = REPORT_TYPE_ORDER.indexOf(b)
    const aRank = aIndex === -1 ? REPORT_TYPE_ORDER.length : aIndex
    const bRank = bIndex === -1 ? REPORT_TYPE_ORDER.length : bIndex
    if (aRank !== bRank) return aRank - bRank
    return a.localeCompare(b)
  })

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Reporting</h2>
          <p className="text-stone-500 text-sm">{incidents.length} total logged</p>
          {canViewSafeguarding && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              Safeguarding Access Enabled
            </p>
          )}
        </div>
        <button onClick={() => {
          setShowForm(s => {
            const next = !s
            if (!next) {
              setSelectedParticipant('')
              setEditingIncidentId(null)
            }
            return next
          })
        }} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
          <Plus size={15} strokeWidth={2.5} /> Log Incident
        </button>
      </div>

      {saveNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 flex flex-wrap items-center gap-2">
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

      {/* New incident form */}
      {showForm && (
        <div className="card border-2 border-amber-200 fade-in">
          <h3 className="font-display font-semibold text-forest-950 mb-3">
            {editingIncident ? 'Edit Submission' : 'Select Participant'}
          </h3>
          <div className="mb-4">
            <label className="label">Participant *</label>
            <select className="input" value={selectedParticipant} disabled={Boolean(editingIncident)} onChange={e => setSelectedParticipant(e.target.value)}>
              <option value="">— Choose participant —</option>
              {[...participants].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.age ? ` (Age ${p.age})` : ''}</option>
              ))}
            </select>
          </div>
          {selectedParticipant && (
            <IncidentForm
              participantId={selectedParticipant}
              participantName={participants.find(p => p.id === selectedParticipant)?.name || ''}
              participantAge={participants.find(p => p.id === selectedParticipant)?.age || ''}
              defaultStaffMember={currentStaffName}
              initial={editingIncident && editingIncident.participantId === selectedParticipant ? editingIncident : null}
              canEditSafeguarding={!editingIncident || canEditSafeguardingIncident(editingIncident)}
              staffList={staffList}
              onSave={saveIncident}
              onCancel={() => {
                setShowForm(false)
                setSelectedParticipant('')
                setEditingIncidentId(null)
              }}
            />
          )}
          {!selectedParticipant && (
            <button onClick={() => { setShowForm(false); setEditingIncidentId(null) }} className="btn-secondary text-sm">Cancel</button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input type="text" placeholder="Search by participant name..." value={search}
          onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setReportSubTab('all')}
          className={`btn-secondary text-sm ${reportSubTab === 'all' ? 'bg-forest-900 text-white border-forest-900' : ''}`}
        >
          All Reports
        </button>
        {REPORT_TYPE_ORDER.map(type => (
          <button
            key={type}
            type="button"
            onClick={() => setReportSubTab(type)}
            className={`btn-secondary text-sm ${reportSubTab === type ? 'bg-forest-900 text-white border-forest-900' : ''}`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* List */}
      {incidents.length === 0 ? (
        <div className="card text-center py-12">
          <AlertTriangle size={32} className="text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No incidents logged yet</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-stone-400 text-sm">No incidents match your search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTypes.map(type => (
            <section key={type} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-display font-semibold text-forest-900">{type}</h3>
                <span className="text-xs text-stone-500">{groupedIncidents[type].length} logged</span>
              </div>
              <div className="space-y-3">
                {groupedIncidents[type].map(inc => {
            const p = participants.find(x => x.id === inc.participantId)
            const createdTime = new Date(inc.createdAt).getTime()
            const updatedRaw = inc.updatedAt || inc.updated_at || null
            const updatedTime = updatedRaw ? new Date(updatedRaw).getTime() : 0
            const isEdited = Boolean(updatedRaw) && updatedTime - createdTime > 1000
            const createdByInitials = inc.createdByInitials || inc.created_by_initials || null
            const updatedByInitials = inc.updatedByInitials || inc.updated_by_initials || null
            const canEditSafeguarding = canEditSafeguardingIncident(inc)
            const isOpeningReport = openingIncidentId === inc.id
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
              <div key={inc.id} className="card hover:shadow-sm transition-shadow group cursor-pointer"
                onClick={() => openIncidentReport(inc)}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 bg-amber-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-display font-semibold text-forest-950 group-hover:text-forest-700">
                        {p?.name || 'Unknown Participant'}
                      </span>
                      <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{inc.type}</span>
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
                      {inc.staffMember && <span className="text-xs text-stone-500">· {inc.staffMember}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-400">
                        {new Date(inc.createdAt).toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {isEdited && (
                        <span className="text-xs text-forest-700">
                          Updated {new Date(updatedRaw).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}{updatedByInitials ? ` by ${updatedByInitials}` : ''}
                        </span>
                      )}
                      {!isEdited && createdByInitials && (
                        <span className="text-xs text-stone-500">Logged by {createdByInitials}</span>
                      )}
                      {inc.followUpRequired && (
                        <span className="text-xs text-stone-500">
                          {inc.followUpCompletedAt
                            ? `Followed up ${new Date(inc.followUpCompletedAt).toLocaleDateString('en-GB')}`
                            : `Follow up due ${new Date((inc.followUpDueDate || inc.createdAt) + 'T12:00:00').toLocaleDateString('en-GB')}`}
                        </span>
                      )}
                      {resolvedAtForIncident(inc) && (
                        <span className="text-xs text-emerald-700">
                          Resolved {new Date(resolvedAtForIncident(inc)).toLocaleDateString('en-GB')}{inc.resolvedBy ? ` by ${inc.resolvedBy}` : ''}
                        </span>
                      )}
                      {inc.pdfName && (
                        <span className="flex items-center gap-1 text-xs text-forest-700 font-medium">
                          <FileText size={11} /> {inc.pdfName}
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
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {p?.parentEmail && (
                      <button onClick={(e) => {
                        e.stopPropagation()
                        const subject = `Incident Report - ${p.name}`
                        let body = `Dear ${p.parentName || 'Parent/Guardian'},\n\n`
                        body += `Please find details of the incident involving ${p.name}.\n\n`
                        if (inc.pdfName) {
                          body += `Attachment: ${inc.pdfName}\n\n`
                        }
                        body += `Incident Type: ${inc.type}\nDate: ${new Date(inc.createdAt).toLocaleDateString('en-GB')}\nReported by: ${inc.staffMember || 'Staff'}\n\n`
                        body += `This email is being sent following our discussion about this incident.`
                        
                        const mailtoLink = `mailto:?bcc=${encodeURIComponent(p.parentEmail)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
                        window.open(mailtoLink, '_blank')
                      }}
                        className="p-1.5 text-stone-400 hover:text-blue-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        title="Email parent">
                        <Mail size={15} />
                      </button>
                    )}
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
                      className="p-1.5 text-stone-400 hover:text-forest-700 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      title={inc.type === 'Safeguarding' && !canEditSafeguarding
                        ? 'Safeguarding edits require authorised access or original submitter'
                        : 'Edit submission'}
                    >
                      <Edit2 size={15} />
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
                    <button onClick={(e) => { e.stopPropagation(); deleteIncident(inc.id) }}
                      className="p-1.5 text-stone-400 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <Trash2 size={15} />
                    </button>
                    {canViewParticipant && p && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onView(p.id)
                        }}
                        className="text-xs px-2 py-1 rounded-md border border-stone-200 text-stone-700 hover:text-forest-900 hover:border-forest-300 bg-white"
                      >
                        View Participant
                      </button>
                    )}
                    <ChevronRight size={16} className="text-stone-300 group-hover:text-stone-500 mt-1" />
                  </div>
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
                        <label className="text-xs font-semibold text-indigo-900 block mb-2">Upload another form/document</label>
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
            )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
