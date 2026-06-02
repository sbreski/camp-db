import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, ChevronRight, Trash2, User, Upload, CameraOff, Camera, ChevronDown, ChevronUp, Users } from 'lucide-react'
import ParticipantForm from './ParticipantForm'
import ImportParticipants from './ImportParticipants'
import ParticipantNameText, { participantDisplayName } from './ParticipantNameText'
import SafeguardingFlagIcon from './SafeguardingFlagIcon'
import { supabase } from '../supabase'
import { hasMeaningfulSendText } from '../utils/send'

function photoConsentMode(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'no') return 'no'
  if (normalized === 'internal') return 'internal'
  return 'ok'
}

function genderOf(p) {
  const pr = String(p.pronouns || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
  if (pr === 'he/him' || pr === 'he/they') return 'm'
  if (pr === 'she/her' || pr === 'she/they') return 'f'
  return 'nb'
}

const GENDER_LABELS = { m: 'Male', f: 'Female', nb: 'Non-binary / other' }
const GENDER_COLORS = {
  m:  { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200',   bar: '#378ADD', dot: 'bg-blue-400' },
  f:  { bg: 'bg-pink-50',   text: 'text-pink-800',   border: 'border-pink-200',   bar: '#D4537E', dot: 'bg-pink-400' },
  nb: { bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-200', bar: '#7F77DD', dot: 'bg-violet-400' },
}
const BAR_COLORS = ['#378ADD', '#1D9E75', '#BA7517', '#D4537E', '#7F77DD', '#D85A30']

function getSplitBoundaries(splits) {
  const sorted = [...splits].sort((a, b) => a - b)
  const bounds = []
  let prev = 0
  for (const s of sorted) {
    bounds.push([prev, s - 1])
    prev = s
  }
  bounds.push([prev, 99])
  return bounds
}

function bucketLabel(lo, hi) {
  return hi >= 99 ? `${lo}+` : `${lo}–${hi}`
}

function ageGroupIndex(age, splits) {
  return getSplitBoundaries(splits).findIndex(([lo, hi]) => age >= lo && age <= hi)
}

function DemographicsPanel({ participants, ageSplits, setAgeSplits, genderFilter, setGenderFilter, ageGroupFilter, setAgeGroupFilter }) {
  const [open, setOpen] = useState(false)
  const bounds = getSplitBoundaries(ageSplits)

  const genderCounts = useMemo(() => {
    const counts = { m: 0, f: 0, nb: 0 }
    participants.forEach(p => { counts[genderOf(p)]++ })
    return counts
  }, [participants])

  const ageBucketCounts = useMemo(() => {
    return bounds.map(([lo, hi]) => participants.filter(p => {
      const age = parseInt(p.age)
      return !isNaN(age) && age >= lo && age <= hi
    }).length)
  }, [participants, ageSplits])

  const total = participants.length || 1

  function toggleGender(g) {
    setGenderFilter(prev => {
      const next = new Set(prev)
      if (next.has(g)) { if (next.size > 1) next.delete(g) }
      else next.add(g)
      return next
    })
  }

  function addSplit() {
    const max = ageSplits.length ? Math.max(...ageSplits) + 4 : 10
    setAgeSplits(prev => [...prev, Math.min(max, 98)])
  }

  function removeSplit(idx) {
    const sorted = [...ageSplits].sort((a, b) => a - b)
    sorted.splice(idx, 1)
    setAgeSplits(sorted)
    if (ageGroupFilter !== null && ageGroupFilter >= sorted.length + 1) {
      setAgeGroupFilter(null)
    }
  }

  function updateSplit(idx, val) {
    const sorted = [...ageSplits].sort((a, b) => a - b)
    const parsed = parseInt(val)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 98) {
      sorted[idx] = parsed
      setAgeSplits([...sorted])
    }
  }

  return (
    <div className="card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Users size={15} className="text-stone-400" />
          <span className="font-display font-semibold text-sm text-forest-950">Demographics &amp; Filters</span>
          <div className="flex gap-1.5 ml-1">
            {(['m', 'f', 'nb']).map(g => (
              <span key={g} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${GENDER_COLORS[g].bg} ${GENDER_COLORS[g].text} ${GENDER_COLORS[g].border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${GENDER_COLORS[g].dot}`} />
                {genderCounts[g]}
              </span>
            ))}
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-stone-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-stone-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="mt-4 space-y-5">

          {/* Gender counts */}
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Gender breakdown</p>
            <div className="grid grid-cols-3 gap-2">
              {(['m', 'f', 'nb']).map(g => {
                const c = GENDER_COLORS[g]
                const pct = participants.length ? Math.round(genderCounts[g] / participants.length * 100) : 0
                return (
                  <div key={g} className={`rounded-lg border p-3 text-center ${c.bg} ${c.border}`}>
                    <p className={`text-xs font-medium mb-1 ${c.text}`}>{GENDER_LABELS[g]}</p>
                    <p className={`text-2xl font-display font-bold ${c.text}`}>{genderCounts[g]}</p>
                    <p className={`text-xs mt-0.5 opacity-70 ${c.text}`}>{pct}%</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Age buckets visualisation */}
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Age groups</p>
            <div className="space-y-1.5">
              {bounds.map(([lo, hi], i) => {
                const count = ageBucketCounts[i]
                const pct = Math.round(count / total * 100)
                const color = BAR_COLORS[i % BAR_COLORS.length]
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-stone-500 w-12 flex-shrink-0 tabular-nums">{bucketLabel(lo, hi)}</span>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-xs font-semibold text-stone-700 w-14 text-right flex-shrink-0 tabular-nums">
                      {count} <span className="font-normal text-stone-400">({pct}%)</span>
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Split point editor */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-400">Split at age:</span>
              {[...ageSplits].sort((a, b) => a - b).map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="number"
                    value={s}
                    min={1}
                    max={98}
                    onChange={e => updateSplit(i, e.target.value)}
                    className="w-12 text-center text-xs border border-stone-200 rounded-md py-1 px-1.5 bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-forest-400"
                  />
                  <button
                    onClick={() => removeSplit(i)}
                    className="text-stone-300 hover:text-red-400 transition-colors text-sm leading-none"
                    title="Remove split"
                  >×</button>
                </div>
              ))}
              <button
                onClick={addSplit}
                className="text-xs text-forest-700 hover:text-forest-900 border border-forest-200 hover:border-forest-400 bg-forest-50 hover:bg-forest-100 px-2 py-1 rounded-md transition-colors"
              >
                + add split
              </button>
            </div>
          </div>

          {/* Filter controls */}
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Filter list</p>

            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="text-xs text-stone-400 self-center mr-1">Gender:</span>
              {(['m', 'f', 'nb']).map(g => {
                const on = genderFilter.has(g)
                const c = GENDER_COLORS[g]
                return (
                  <button
                    key={g}
                    onClick={() => toggleGender(g)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${on ? `${c.bg} ${c.text} ${c.border}` : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'}`}
                  >
                    {GENDER_LABELS[g]}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-stone-400 self-center mr-1">Age group:</span>
              <button
                onClick={() => setAgeGroupFilter(null)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${ageGroupFilter === null ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'}`}
              >
                All
              </button>
              {bounds.map(([lo, hi], i) => (
                <button
                  key={i}
                  onClick={() => setAgeGroupFilter(ageGroupFilter === i ? null : i)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${ageGroupFilter === i ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-400 border-stone-200 hover:border-stone-300'}`}
                >
                  {bucketLabel(lo, hi)}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

export default function Participants({ participants, setParticipants, deleteParticipant: deleteParticipantRecord, onView, canViewUploadedData = false, currentUserEmail = '' }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showAllTable, setShowAllTable] = useState(false)
  const [allTableUnlocked, setAllTableUnlocked] = useState(false)
  const [allTablePassword, setAllTablePassword] = useState('')
  const [allTableUnlocking, setAllTableUnlocking] = useState(false)
  const [allTableError, setAllTableError] = useState('')
  const [allTableEditing, setAllTableEditing] = useState(false)
  const [allTableDraftById, setAllTableDraftById] = useState({})
  const [allTableSaving, setAllTableSaving] = useState(false)
  const [allTableSaveNotice, setAllTableSaveNotice] = useState('')
  const [allTableEditError, setAllTableEditError] = useState('')
  const [allTablePendingAutoSave, setAllTablePendingAutoSave] = useState(false)
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([])
  const [subTab, setSubTab] = useState('active')
  const [sortKey, setSortKey] = useState('firstName')
  const [sortDirection, setSortDirection] = useState('asc')

  // Demographics / filter state
  const [ageSplits, setAgeSplits] = useState([10, 14, 18])
  const [genderFilter, setGenderFilter] = useState(new Set(['m', 'f', 'nb']))
  const [ageGroupFilter, setAgeGroupFilter] = useState(null)

  function addParticipant(data) {
    setParticipants(prev => [...prev, { ...data, id: crypto.randomUUID() }])
    setShowForm(false)
  }

  function importParticipants(list) {
    return setParticipants(prev => {
      // Merge: update existing records matched by id, then append genuinely new ones
      const updated = prev.map(p => {
        const match = list.find(item => item.id === p.id)
        if (!match) return p
        const { _isUpdate, ...fields } = match
        return { ...p, ...fields }
      })
      const newOnes = list
        .filter(item => !prev.find(p => p.id === item.id))
        .map(({ _isUpdate, ...fields }) => fields)
      return [...updated, ...newOnes]
    })
  }

  async function deleteParticipant(id) {
    if (window.confirm('Delete this participant? This cannot be undone.')) {
      const result = await deleteParticipantRecord(id)
      if (!result?.ok) alert(result?.error || 'Unable to delete this participant.')
    }
  }

  function isIncludedThisSeason(participant) {
    const flag = participant.isActiveThisSeason ?? participant.is_active_this_season
    if (typeof flag === 'string') return flag.toLowerCase() !== 'false'
    return flag !== false
  }

  function nameParts(participant) {
    const full = String(participant?.name || '').trim()
    const parts = full.split(/\s+/).filter(Boolean)
    return {
      firstName: parts[0] || '',
      lastName: parts.length > 1 ? parts[parts.length - 1] : '',
      fullName: full,
    }
  }

  function compareParticipants(a, b) {
    const direction = sortDirection === 'asc' ? 1 : -1

    if (sortKey === 'age') {
      const ageA = parseInt(a.age)
      const ageB = parseInt(b.age)
      const hasAgeA = !Number.isNaN(ageA)
      const hasAgeB = !Number.isNaN(ageB)
      if (!hasAgeA && !hasAgeB) return participantDisplayName(a).localeCompare(participantDisplayName(b))
      if (!hasAgeA) return 1
      if (!hasAgeB) return -1
      if (ageA !== ageB) return (ageA - ageB) * direction
      return participantDisplayName(a).localeCompare(participantDisplayName(b))
    }

    if (sortKey === 'gender') {
      const genderA = genderOf(a)
      const genderB = genderOf(b)
      if (genderA !== genderB) return genderA.localeCompare(genderB) * direction
      return participantDisplayName(a).localeCompare(participantDisplayName(b))
    }

    const nameA = nameParts(a)
    const nameB = nameParts(b)
    const keyA = sortKey === 'lastName' ? nameA.lastName : nameA.firstName
    const keyB = sortKey === 'lastName' ? nameB.lastName : nameB.firstName
    const primary = keyA.localeCompare(keyB)
    if (primary !== 0) return primary * direction
    return nameA.fullName.localeCompare(nameB.fullName)
  }

  const filteredBySearch = useMemo(() => (
    [...participants]
      .filter(p => participantDisplayName(p).toLowerCase().includes(search.toLowerCase()))
      .filter(p => genderFilter.has(genderOf(p)))
      .filter(p => {
        if (ageGroupFilter === null) return true
        const age = parseInt(p.age)
        if (isNaN(age)) return false
        return ageGroupIndex(age, ageSplits) === ageGroupFilter
      })
      .sort(compareParticipants)
  ), [participants, search, genderFilter, ageGroupFilter, ageSplits, sortKey, sortDirection])

  const activeParticipants = filteredBySearch.filter(isIncludedThisSeason)
  const inactiveParticipants = filteredBySearch.filter(p => !isIncludedThisSeason(p))
  let visibleParticipants = []
  if (subTab === 'active') visibleParticipants = activeParticipants
  else if (subTab === 'inactive') visibleParticipants = inactiveParticipants
  else visibleParticipants = filteredBySearch

  const selectedSet = new Set(selectedParticipantIds)
  const selectedVisibleParticipantIds = visibleParticipants.filter(p => selectedSet.has(p.id)).map(p => p.id)
  const allVisibleSelected = visibleParticipants.length > 0 && visibleParticipants.every(p => selectedSet.has(p.id))

  function toggleParticipantSelection(participantId) {
    setSelectedParticipantIds(prev => (
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    ))
  }

  function toggleSelectAllFiltered() {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleParticipants.map(p => p.id))
      setSelectedParticipantIds(prev => prev.filter(id => !visibleIds.has(id)))
      return
    }
    setSelectedParticipantIds(prev => [...new Set([...prev, ...visibleParticipants.map(p => p.id)])])
  }

  function clearSelection() {
    setSelectedParticipantIds([])
  }

  function setIncludedForSelected(isIncluded) {
    if (selectedVisibleParticipantIds.length === 0) {
      alert('Select at least one participant first.')
      return
    }
    const targetIds = new Set(selectedVisibleParticipantIds)
    setParticipants(prev => prev.map(participant => (
      targetIds.has(participant.id)
        ? { ...participant, isActiveThisSeason: isIncluded }
        : participant
    )))
    setSelectedParticipantIds(prev => prev.filter(id => !targetIds.has(id)))
  }

  const activeFilterCount = (genderFilter.size < 3 ? 1 : 0) + (ageGroupFilter !== null ? 1 : 0)
  const allParticipantsSorted = useMemo(() => (
    [...participants].sort((a, b) => participantDisplayName(a).localeCompare(participantDisplayName(b)))
  ), [participants])

  function buildAllTableDraftRow(participant) {
    return {
      name: String(participant.name || ''),
      pronouns: String(participant.pronouns || ''),
      age: String(participant.age ?? ''),
      birthday: String(participant.birthday || participant.dob || ''),
      schoolAttending: String(participant.schoolAttending || ''),
      postcode: String(participant.postcode || ''),
      address: String(participant.address || ''),
      siblings: Boolean(participant.siblings),
      siblingsName: String(participant.siblingsName || ''),
      parentName: String(participant.parentName || ''),
      parentRelationship: String(participant.parentRelationship || ''),
      parentPhone: String(participant.parentPhone || ''),
      parentEmail: String(participant.parentEmail || ''),
      parent2Name: String(participant.parent2Name || ''),
      parent2Phone: String(participant.parent2Phone || ''),
      parent2Email: String(participant.parent2Email || ''),
      homePhone: String(participant.homePhone || ''),
      can_leave_alone: Boolean(participant.can_leave_alone ?? participant.canLeaveAlone),
      approvedAdults: String(participant.approvedAdults || ''),
      photoConsent: String(participant.photoConsent || 'yes'),
      medicalTypeText: Array.isArray(participant.medicalType) ? participant.medicalType.join(', ') : String(participant.medicalType || ''),
      medicalDetails: String(participant.medicalDetails || ''),
      allergyDetails: String(participant.allergyDetails || ''),
      dietaryType: String(participant.dietaryType || ''),
      otcNotes: String(participant.otcNotes || ''),
      sendNeeds: String(participant.sendNeeds || ''),
      sendDiagnosed: Boolean(participant.sendDiagnosed),
      sendDiagnosis: String(participant.sendDiagnosis || ''),
      notes: String(participant.notes || ''),
      familyGroupKey: String(participant.familyGroupKey || participant.family_group_key || ''),
    }
  }

  function normalizeMedicalTypeFromText(value) {
    return String(value || '')
      .split(/[;,|/\n]+/)
      .map(item => item.trim())
      .filter(Boolean)
      .map((item) => {
        const key = item.toLowerCase()
        if (key.startsWith('allerg') || key === 'a') return 'Allergy'
        if (key.startsWith('diet') || key === 'd') return 'Dietary'
        if (key.startsWith('med') || key === 'm') return 'Medical'
        return null
      })
      .filter(Boolean)
  }

  function rowDraftHasChanges(participant, draft) {
    const baseline = buildAllTableDraftRow(participant)
    const keys = Object.keys(baseline)
    return keys.some((key) => {
      if (typeof baseline[key] === 'boolean') return Boolean(baseline[key]) !== Boolean(draft?.[key])
      return String(baseline[key] ?? '') !== String(draft?.[key] ?? '')
    })
  }

  function allDraftsHaveChanges() {
    return allParticipantsSorted.some((participant) => {
      const draft = allTableDraftById[participant.id]
      if (!draft) return false
      return rowDraftHasChanges(participant, draft)
    })
  }

  function startAllTableEdit() {
    const drafts = {}
    allParticipantsSorted.forEach((participant) => {
      drafts[participant.id] = buildAllTableDraftRow(participant)
    })
    setAllTableDraftById(drafts)
    setAllTableEditing(true)
    setAllTableEditError('')
    setAllTableSaveNotice('')
  }

  function cancelAllTableEdit() {
    setAllTableEditing(false)
    setAllTableDraftById({})
    setAllTableEditError('')
    setAllTableSaveNotice('')
  }

  function updateAllTableDraft(participantId, key, value) {
    setAllTableDraftById(prev => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] || {}),
        [key]: value,
      },
    }))
    if (allTableEditError) setAllTableEditError('')
    setAllTableSaveNotice('Saving...')
    setAllTablePendingAutoSave(true)
  }

  async function saveAllTableEdits(exitAfterSave = false) {
    if (!allDraftsHaveChanges()) {
      if (exitAfterSave) {
        setAllTableEditing(false)
        setAllTableDraftById({})
      }
      return
    }

    setAllTableSaving(true)
    setAllTableEditError('')
    setAllTableSaveNotice('Saving...')

    const result = await setParticipants(prev => prev.map((participant) => {
      const draft = allTableDraftById[participant.id]
      if (!draft) return participant

      const parsedAge = parseInt(String(draft.age || '').trim(), 10)
      const normalizedPhotoConsent = String(draft.photoConsent || '').trim().toLowerCase()

      return {
        ...participant,
        name: String(draft.name || '').trim() || participant.name,
        pronouns: String(draft.pronouns || '').trim(),
        age: Number.isNaN(parsedAge) ? '' : parsedAge,
        birthday: String(draft.birthday || '').trim(),
        schoolAttending: String(draft.schoolAttending || '').trim(),
        postcode: String(draft.postcode || '').trim(),
        address: String(draft.address || '').trim(),
        siblings: Boolean(draft.siblings),
        siblingsName: String(draft.siblingsName || '').trim(),
        parentName: String(draft.parentName || '').trim(),
        parentRelationship: String(draft.parentRelationship || '').trim(),
        parentPhone: String(draft.parentPhone || '').trim(),
        parentEmail: String(draft.parentEmail || '').trim(),
        parent2Name: String(draft.parent2Name || '').trim(),
        parent2Phone: String(draft.parent2Phone || '').trim(),
        parent2Email: String(draft.parent2Email || '').trim(),
        homePhone: String(draft.homePhone || '').trim(),
        can_leave_alone: Boolean(draft.can_leave_alone),
        approvedAdults: String(draft.approvedAdults || '').trim(),
        photoConsent: normalizedPhotoConsent === 'no' ? 'no' : normalizedPhotoConsent === 'internal' ? 'internal' : 'yes',
        medicalType: normalizeMedicalTypeFromText(draft.medicalTypeText),
        medicalDetails: String(draft.medicalDetails || '').trim(),
        allergyDetails: String(draft.allergyDetails || '').trim(),
        dietaryType: String(draft.dietaryType || '').trim(),
        otcNotes: String(draft.otcNotes || '').trim(),
        sendNeeds: String(draft.sendNeeds || '').trim(),
        sendDiagnosed: Boolean(draft.sendDiagnosed),
        sendDiagnosis: String(draft.sendDiagnosis || '').trim(),
        notes: String(draft.notes || '').trim(),
        familyGroupKey: String(draft.familyGroupKey || '').trim(),
      }
    }))

    setAllTableSaving(false)
    if (result && result.ok === false) {
      const firstError = Array.isArray(result.errors) && result.errors.length > 0
        ? result.errors[0]
        : 'Unable to save all table edits.'
      setAllTableEditError(firstError)
      return
    }

    setAllTablePendingAutoSave(false)
    setAllTableSaveNotice('All changes saved.')
    if (exitAfterSave) {
      setAllTableEditing(false)
      setAllTableDraftById({})
    }
  }

  useEffect(() => {
    if (!allTableEditing) return
    if (!allTablePendingAutoSave) return
    if (allTableSaving) return

    const timer = setTimeout(() => {
      saveAllTableEdits(false)
    }, 700)

    return () => clearTimeout(timer)
  }, [allTableEditing, allTablePendingAutoSave, allTableSaving, allTableDraftById])

  async function unlockAllParticipantsTable() {
    const email = String(currentUserEmail || '').trim().toLowerCase()
    if (!email) {
      setAllTableError('Unable to verify account email for this session.')
      return
    }
    if (!allTablePassword) {
      setAllTableError('Enter your login password to continue.')
      return
    }

    setAllTableUnlocking(true)
    setAllTableError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: allTablePassword })
    setAllTableUnlocking(false)

    if (error) {
      setAllTableError('Password check failed. Try again.')
      return
    }

    setAllTableUnlocked(true)
    setAllTablePassword('')
    setAllTableEditing(false)
    setAllTableDraftById({})
    setAllTableEditError('')
    setAllTableSaveNotice('')
  }

  return (
    <div className="fade-in space-y-5">
      {showImport && (
        <ImportParticipants
          onImport={importParticipants}
          existingParticipants={participants}
          onClose={() => setShowImport(false)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Participants</h2>
          <p className="text-stone-500 text-sm">{participants.length} registered</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {canViewUploadedData && (
            <button
              onClick={() => setShowAllTable(prev => !prev)}
              className="btn-secondary flex items-center justify-center gap-2 flex-1 sm:flex-none"
            >
              {showAllTable ? 'Hide All-Participants Table' : 'Show All-Participants Table'}
            </button>
          )}
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center justify-center gap-2 flex-1 sm:flex-none">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center justify-center gap-2 flex-1 sm:flex-none">
            <Plus size={15} strokeWidth={2.5} /> Add
          </button>
        </div>
      </div>

      {showForm && (
        <ParticipantForm onSave={addParticipant} onCancel={() => setShowForm(false)} />
      )}

      {canViewUploadedData && showAllTable && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display font-semibold text-forest-950">All Participants Data Table (Protected)</h3>
            <div className="flex items-center gap-2">
              {allTableUnlocked && !allTableEditing && (
                <button
                  type="button"
                  onClick={startAllTableEdit}
                  className="btn-secondary text-xs"
                >
                  Edit Table
                </button>
              )}
              {allTableUnlocked && allTableEditing && (
                <>
                  <button
                    type="button"
                    onClick={() => saveAllTableEdits(true)}
                    disabled={allTableSaving}
                    className="btn-secondary text-xs"
                  >
                    {allTableSaving ? 'Saving...' : 'Done'}
                  </button>
                </>
              )}
              {allTableUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    setAllTableUnlocked(false)
                    setAllTableEditing(false)
                    setAllTableDraftById({})
                    setAllTableEditError('')
                    setAllTableSaveNotice('')
                  }}
                  className="text-xs text-stone-500 hover:text-stone-700 underline"
                >
                  Lock
                </button>
              )}
            </div>
          </div>

          {!allTableUnlocked ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2">
              <p className="text-xs text-stone-600">Enter your own login password to view all participants in one table.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  className="input flex-1"
                  value={allTablePassword}
                  onChange={e => setAllTablePassword(e.target.value)}
                  placeholder="Your account password"
                />
                <button
                  type="button"
                  onClick={unlockAllParticipantsTable}
                  disabled={allTableUnlocking}
                  className={`btn-secondary ${allTableUnlocking ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {allTableUnlocking ? 'Checking...' : 'Unlock'}
                </button>
              </div>
              {allTableError && <p className="text-xs text-red-700">{allTableError}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {allTableEditError && <p className="text-xs text-red-700">{allTableEditError}</p>}
              {allTableSaveNotice && <p className="text-xs text-emerald-700">{allTableSaveNotice}</p>}
              {allTableEditing && !allTableEditError && <p className="text-xs text-amber-700">Editing mode is on. Changes auto-save.</p>}
              <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-xs">
                <thead className="bg-stone-50">
                  <tr>
                    {[
                      'Full Name',
                      'Pronouns',
                      'Age',
                      'Date of Birth',
                      'School Attending',
                      'Postcode',
                      'Address',
                      'Siblings?',
                      'Siblings Name',
                      'Parent Name',
                      'Primary Adult Relationship',
                      'Parent Phone',
                      'Parent Email',
                      'Additional Adult Name',
                      'Additional Adult Phone',
                      'Additional Adult Email',
                      'Home Phone',
                      'Permission to Leave Unaccompanied',
                      'Approved Adults',
                      'Photo Consent',
                      'Medical Type',
                      'Medical Info',
                      'Allergy Details',
                      'Dietary Requirements',
                      'Medication Details / OTC Notes',
                      'Additional Needs / SEND Support',
                      'EHCP / Diagnosed',
                      'Diagnosis / If yes or not sure',
                      'Declaration / Additional Notes',
                      'Family Group Key',
                    ].map(header => (
                      <th key={header} className="text-left px-3 py-2 font-semibold text-stone-600 uppercase tracking-wide whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {allParticipantsSorted.map((p) => {
                    const rowDraft = allTableEditing ? (allTableDraftById[p.id] || buildAllTableDraftRow(p)) : null
                    return (
                      <tr key={p.id} className="hover:bg-stone-50">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.name} onChange={e => updateAllTableDraft(p.id, 'name', e.target.value)} />
                          ) : participantDisplayName(p)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.pronouns} onChange={e => updateAllTableDraft(p.id, 'pronouns', e.target.value)} />
                          ) : (p.pronouns || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input type="number" className="input py-1" value={rowDraft.age} onChange={e => updateAllTableDraft(p.id, 'age', e.target.value)} />
                          ) : (p.age || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input type="date" className="input py-1" value={rowDraft.birthday} onChange={e => updateAllTableDraft(p.id, 'birthday', e.target.value)} />
                          ) : (p.birthday || p.dob || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.schoolAttending} onChange={e => updateAllTableDraft(p.id, 'schoolAttending', e.target.value)} />
                          ) : (p.schoolAttending || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.postcode} onChange={e => updateAllTableDraft(p.id, 'postcode', e.target.value)} />
                          ) : (p.postcode || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {allTableEditing ? (
                            <textarea className="input resize-none" rows={2} value={rowDraft.address} onChange={e => updateAllTableDraft(p.id, 'address', e.target.value)} />
                          ) : (p.address || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input type="checkbox" className="h-4 w-4" checked={Boolean(rowDraft.siblings)} onChange={e => updateAllTableDraft(p.id, 'siblings', e.target.checked)} />
                          ) : (p.siblings ? 'Yes' : 'No')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.siblingsName} onChange={e => updateAllTableDraft(p.id, 'siblingsName', e.target.value)} />
                          ) : (p.siblingsName || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.parentName} onChange={e => updateAllTableDraft(p.id, 'parentName', e.target.value)} />
                          ) : (p.parentName || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.parentRelationship || ''} onChange={e => updateAllTableDraft(p.id, 'parentRelationship', e.target.value)} />
                          ) : (p.parentRelationship || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.parentPhone} onChange={e => updateAllTableDraft(p.id, 'parentPhone', e.target.value)} />
                          ) : (p.parentPhone || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input type="email" className="input py-1" value={rowDraft.parentEmail} onChange={e => updateAllTableDraft(p.id, 'parentEmail', e.target.value)} />
                          ) : (p.parentEmail || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.parent2Name || ''} onChange={e => updateAllTableDraft(p.id, 'parent2Name', e.target.value)} />
                          ) : (p.parent2Name || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.parent2Phone || ''} onChange={e => updateAllTableDraft(p.id, 'parent2Phone', e.target.value)} />
                          ) : (p.parent2Phone || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input type="email" className="input py-1" value={rowDraft.parent2Email || ''} onChange={e => updateAllTableDraft(p.id, 'parent2Email', e.target.value)} />
                          ) : (p.parent2Email || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.homePhone || ''} onChange={e => updateAllTableDraft(p.id, 'homePhone', e.target.value)} />
                          ) : (p.homePhone || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input type="checkbox" className="h-4 w-4" checked={Boolean(rowDraft.can_leave_alone)} onChange={e => updateAllTableDraft(p.id, 'can_leave_alone', e.target.checked)} />
                          ) : ((p.can_leave_alone || p.canLeaveAlone) ? 'Yes' : 'No')}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {allTableEditing ? (
                            <textarea className="input resize-none" rows={2} value={rowDraft.approvedAdults} onChange={e => updateAllTableDraft(p.id, 'approvedAdults', e.target.value)} />
                          ) : (p.approvedAdults || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <select className="input py-1" value={rowDraft.photoConsent} onChange={e => updateAllTableDraft(p.id, 'photoConsent', e.target.value)}>
                              <option value="yes">yes</option>
                              <option value="no">no</option>
                              <option value="internal">internal</option>
                            </select>
                          ) : (p.photoConsent || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.medicalTypeText} onChange={e => updateAllTableDraft(p.id, 'medicalTypeText', e.target.value)} placeholder="Allergy, Medical" />
                          ) : (Array.isArray(p.medicalType) ? (p.medicalType.join(', ') || '—') : (p.medicalType || '—'))}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {allTableEditing ? (
                            <textarea className="input resize-none" rows={2} value={rowDraft.medicalDetails} onChange={e => updateAllTableDraft(p.id, 'medicalDetails', e.target.value)} />
                          ) : (p.medicalDetails || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {allTableEditing ? (
                            <textarea className="input resize-none" rows={2} value={rowDraft.allergyDetails} onChange={e => updateAllTableDraft(p.id, 'allergyDetails', e.target.value)} />
                          ) : (p.allergyDetails || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {allTableEditing ? (
                            <textarea className="input resize-none" rows={2} value={rowDraft.dietaryType} onChange={e => updateAllTableDraft(p.id, 'dietaryType', e.target.value)} />
                          ) : (p.dietaryType || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {allTableEditing ? (
                            <textarea className="input resize-none" rows={2} value={rowDraft.otcNotes} onChange={e => updateAllTableDraft(p.id, 'otcNotes', e.target.value)} />
                          ) : (p.otcNotes || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {allTableEditing ? (
                            <textarea className="input resize-none" rows={2} value={rowDraft.sendNeeds} onChange={e => updateAllTableDraft(p.id, 'sendNeeds', e.target.value)} />
                          ) : (p.sendNeeds || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input type="checkbox" className="h-4 w-4" checked={Boolean(rowDraft.sendDiagnosed)} onChange={e => updateAllTableDraft(p.id, 'sendDiagnosed', e.target.checked)} />
                          ) : (p.sendDiagnosed ? 'Yes' : 'No')}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {allTableEditing ? (
                            <textarea className="input resize-none" rows={2} value={rowDraft.sendDiagnosis} onChange={e => updateAllTableDraft(p.id, 'sendDiagnosis', e.target.value)} />
                          ) : (p.sendDiagnosis || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-pre-wrap">
                          {allTableEditing ? (
                            <textarea className="input resize-none" rows={2} value={rowDraft.notes} onChange={e => updateAllTableDraft(p.id, 'notes', e.target.value)} />
                          ) : (p.notes || '—')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {allTableEditing ? (
                            <input className="input py-1" value={rowDraft.familyGroupKey} onChange={e => updateAllTableDraft(p.id, 'familyGroupKey', e.target.value)} />
                          ) : (p.familyGroupKey || p.family_group_key || '—')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-stone-500" htmlFor="participants-sort-by">Sort by</label>
        <select
          id="participants-sort-by"
          className="input py-1.5 text-sm w-auto min-w-40"
          value={sortKey}
          onChange={e => setSortKey(e.target.value)}
        >
          <option value="firstName">First name</option>
          <option value="lastName">Last name</option>
          <option value="age">Age</option>
          <option value="gender">Gender</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))}
          className="btn-secondary text-xs py-1.5"
          aria-label="Toggle sort direction"
        >
          {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        </button>
      </div>

      {/* Demographics & filter panel */}
      <DemographicsPanel
        participants={participants}
        ageSplits={ageSplits}
        setAgeSplits={setAgeSplits}
        genderFilter={genderFilter}
        setGenderFilter={setGenderFilter}
        ageGroupFilter={ageGroupFilter}
        setAgeGroupFilter={setAgeGroupFilter}
      />

      {/* Active filter indicator */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-stone-500">
            Filters active — showing {filteredBySearch.length} of {participants.length} participants
          </span>
          <button
            onClick={() => { setGenderFilter(new Set(['m', 'f', 'nb'])); setAgeGroupFilter(null) }}
            className="text-xs text-rose-600 hover:text-rose-800 underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {participants.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSubTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-colors ${
              subTab === 'active'
                ? 'bg-forest-900 text-white border-forest-900'
                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
            }`}
          >
            Active ({activeParticipants.length})
          </button>
          <button
            onClick={() => setSubTab('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-colors ${
              subTab === 'inactive'
                ? 'bg-stone-700 text-white border-stone-700'
                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
            }`}
          >
            Inactive ({inactiveParticipants.length})
          </button>
          <button
            onClick={() => setSubTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold border transition-colors ${
              subTab === 'all'
                ? 'bg-amber-700 text-white border-amber-700'
                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
            }`}
          >
            All ({filteredBySearch.length})
          </button>
        </div>
      )}

      {participants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={toggleSelectAllFiltered} className="btn-secondary text-xs py-1.5">
            {allVisibleSelected ? 'Unselect All' : 'Select All'}
          </button>
          {subTab === 'active' && (
            <button onClick={() => setIncludedForSelected(false)} className="btn-secondary text-xs py-1.5" disabled={selectedVisibleParticipantIds.length === 0}>
              Set Inactive
            </button>
          )}
          {subTab === 'inactive' && (
            <button onClick={() => setIncludedForSelected(true)} className="btn-primary text-xs py-1.5" disabled={selectedVisibleParticipantIds.length === 0}>
              Set Active
            </button>
          )}
          <button onClick={clearSelection} className="btn-secondary text-xs py-1.5" disabled={selectedVisibleParticipantIds.length === 0}>
            Clear
          </button>
          <span className="text-xs text-stone-500">{selectedVisibleParticipantIds.length} highlighted</span>
        </div>
      )}

      {participants.length === 0 ? (
        <div className="card text-center py-12">
          <User size={32} className="text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No participants yet</p>
          <p className="text-stone-400 text-sm mt-1">Add individually or import a CSV file.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleParticipants.map(p => {
            const g = genderOf(p)
            const gc = GENDER_COLORS[g]
            return (
              <div
                key={p.id}
                className={`card flex items-center gap-4 hover:shadow-sm transition-shadow group ${selectedSet.has(p.id) ? 'ring-2 ring-forest-300 border-forest-300 bg-forest-50/40' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(p.id)}
                  onChange={() => toggleParticipantSelection(p.id)}
                  className="h-4 w-4 flex-shrink-0"
                  aria-label={`Select ${participantDisplayName(p)}`}
                />
                <div
                  onClick={() => onView(p.id)}
                  className="w-10 h-10 rounded-full bg-forest-900 flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0 cursor-pointer"
                >
                  {participantDisplayName(p).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(p.id)}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <ParticipantNameText participant={p} showDiagnosedHighlight={false} className="font-display font-semibold text-forest-950 group-hover:text-forest-700" />
                    {photoConsentMode(p.photoConsent) === 'no' && (
                      <CameraOff size={12} className="text-rose-700" title="No photo consent" />
                    )}
                    {photoConsentMode(p.photoConsent) === 'internal' && (
                      <span className="relative inline-flex" title="Photo consent: internal use only">
                        <Camera size={12} className="text-amber-700" />
                        <span className="absolute -top-1 -right-1 text-[8px] font-bold leading-none text-amber-900">!</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 truncate">
                    {[p.pronouns, p.age ? `Age ${p.age}` : null, p.role].filter(Boolean).join(' · ')}
                  </p>
                  {/* Badges inline on mobile below the name */}
                  <div className="flex items-center gap-1 flex-wrap mt-1 sm:hidden">
                    {(() => {
                      const hasSendDiagnosis = hasMeaningfulSendText(p.sendDiagnosis)
                      const hasDiagnosedSend = Boolean(p.sendDiagnosed) || hasSendDiagnosis
                      const hasSend = hasMeaningfulSendText(p.sendNeeds) || hasDiagnosedSend
                      if (!hasSend) return null
                      return <span className={hasDiagnosedSend ? 'badge-send-diagnosed' : 'badge-send'}>S</span>
                    })()}
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold border ${gc.bg} ${gc.text} ${gc.border}`}>
                      {g === 'm' ? 'M' : g === 'f' ? 'F' : 'NB'}
                    </span>
                    {p.medicalType?.includes('Allergy') && <span className="badge-allergy">A</span>}
                    {p.medicalType?.includes('Dietary') && <span className="badge-dietary">D</span>}
                    {p.medicalType?.includes('Medical') && <span className="badge-medical">M</span>}
                    {p.safeguardingFlag && <SafeguardingFlagIcon className="px-2 py-0.5" size={11} />}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${isIncludedThisSeason(p) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                      {isIncludedThisSeason(p) ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                {/* Badges on the right — desktop only */}
                <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                  {(() => {
                    const hasSendDiagnosis = hasMeaningfulSendText(p.sendDiagnosis)
                    const hasDiagnosedSend = Boolean(p.sendDiagnosed) || hasSendDiagnosis
                    const hasSend = hasMeaningfulSendText(p.sendNeeds) || hasDiagnosedSend
                    if (!hasSend) return null
                    return <span className={hasDiagnosedSend ? 'badge-send-diagnosed' : 'badge-send'}>S</span>
                  })()}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold border ${gc.bg} ${gc.text} ${gc.border}`}>
                    {g === 'm' ? 'M' : g === 'f' ? 'F' : 'NB'}
                  </span>
                  {p.medicalType?.includes('Allergy') && <span className="badge-allergy">A</span>}
                  {p.medicalType?.includes('Dietary') && <span className="badge-dietary">D</span>}
                  {p.medicalType?.includes('Medical') && <span className="badge-medical">M</span>}
                  {p.safeguardingFlag && <SafeguardingFlagIcon className="px-2 py-0.5" size={11} />}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${isIncludedThisSeason(p) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                    {isIncludedThisSeason(p) ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button
                  onClick={() => deleteParticipant(p.id)}
                  className="p-1.5 text-stone-400 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
                <button onClick={() => onView(p.id)} className="text-stone-400 hover:text-forest-700 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>
            )
          })}
          {visibleParticipants.length === 0 && (
            <div className="card text-center py-10">
              <p className="text-stone-500 font-medium">No participants match the current filters</p>
              <p className="text-stone-400 text-sm mt-1">
                {activeFilterCount > 0
                  ? 'Try adjusting the gender or age group filters above.'
                  : subTab === 'included'
                    ? 'Everyone is currently marked Not Included.'
                    : 'Everyone is currently marked Included.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
