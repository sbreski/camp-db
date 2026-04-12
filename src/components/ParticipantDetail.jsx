import { useEffect, useState } from 'react'
import { ArrowLeft, Edit2, Clock, AlertTriangle, Phone, Mail, User, FileText, Share2, Trash2 } from 'lucide-react'
import ParticipantForm from './ParticipantForm'
import IncidentForm from './IncidentForm'
import ParticipantNameText from './ParticipantNameText'
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

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const TABS = ['Overview', 'Medical', 'SEND / Support', 'Attendance', 'Incidents']

export default function ParticipantDetail({
  participant, participants, setParticipants,
  attendance, incidents, setIncidents, staffList = [], actorInitials = 'ST', actorUserId = '', currentStaffName = '', canViewSafeguarding = false, canViewSendDiagnosis = false, canManageShares = false, onBack
}) {
  const [editing, setEditing] = useState(false)
  const [showIncident, setShowIncident] = useState(false)
  const [editingIncidentId, setEditingIncidentId] = useState(null)
  const [activeTab, setActiveTab] = useState('Overview')
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
    setParticipants(prev => prev.map(p => p.id === participant.id ? { ...p, ...data } : p))
    setEditing(false)
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

  const participantAttendance = attendance
    .filter(a => a.participantId === participantId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const participantIncidents = incidents
    .filter(i => i.participantId === participantId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

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
        <ParticipantForm initial={participant} onSave={saveEdit} onCancel={() => setEditing(false)} />
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
          {participant.safeguardingFlag && <span className="badge-safeguarding">Safeguarding Flag</span>}
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
          </div>
        )}

        {/* MEDICAL */}
        {activeTab === 'Medical' && (
          <div className="card">
            <h3 className="font-display font-semibold text-forest-950 mb-4">Medical, Allergy & Dietary</h3>
            {hasMedical ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {participant.medicalType?.map(t => (
                    <span key={t} className={
                      t === 'Allergy' || t === 'Dietary' ? 'badge-allergy text-sm px-3 py-1' :
                      t === 'Medical' ? 'badge-medical text-sm px-3 py-1' :
                      'badge-dietary text-sm px-3 py-1'
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
                      {user.email}
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
                  const isOpeningReport = openingIncidentId === inc.id
                  const isDownloadingReport = downloadingIncidentId === inc.id
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
                    <div className="mt-3">
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
                    </div>
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
