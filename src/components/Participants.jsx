import { useState, useMemo } from 'react'
import { Plus, Search, ChevronRight, Trash2, User, Upload, CameraOff, Camera, ChevronDown, ChevronUp, Users } from 'lucide-react'
import ParticipantForm from './ParticipantForm'
import ImportParticipants from './ImportParticipants'
import ParticipantNameText, { participantDisplayName } from './ParticipantNameText'
import SafeguardingFlagIcon from './SafeguardingFlagIcon'

function photoConsentMode(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'no') return 'no'
  if (normalized === 'internal') return 'internal'
  return 'ok'
}

function genderOf(p) {
  const pr = String(p.pronouns || '').trim().toLowerCase()
  if (pr === 'he/him') return 'm'
  if (pr === 'she/her') return 'f'
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

export default function Participants({ participants, setParticipants, onView }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([])
  const [subTab, setSubTab] = useState('active')

  // Demographics / filter state
  const [ageSplits, setAgeSplits] = useState([10, 14, 18])
  const [genderFilter, setGenderFilter] = useState(new Set(['m', 'f', 'nb']))
  const [ageGroupFilter, setAgeGroupFilter] = useState(null)

  function addParticipant(data) {
    setParticipants(prev => [...prev, { ...data, id: crypto.randomUUID() }])
    setShowForm(false)
  }

  function importParticipants(list) {
    setParticipants(prev => [...prev, ...list])
  }

  function deleteParticipant(id) {
    if (window.confirm('Delete this participant? This cannot be undone.')) {
      setParticipants(prev => prev.filter(p => p.id !== id))
    }
  }

  function isIncludedThisSeason(participant) {
    const flag = participant.isActiveThisSeason ?? participant.is_active_this_season
    if (typeof flag === 'string') return flag.toLowerCase() !== 'false'
    return flag !== false
  }

  const filteredBySearch = useMemo(() => (
    [...participants]
      .sort((a, b) => participantDisplayName(a).localeCompare(participantDisplayName(b)))
      .filter(p => participantDisplayName(p).toLowerCase().includes(search.toLowerCase()))
      .filter(p => genderFilter.has(genderOf(p)))
      .filter(p => {
        if (ageGroupFilter === null) return true
        const age = parseInt(p.age)
        if (isNaN(age)) return false
        return ageGroupIndex(age, ageSplits) === ageGroupFilter
      })
  ), [participants, search, genderFilter, ageGroupFilter, ageSplits])

  const activeParticipants = filteredBySearch.filter(isIncludedThisSeason)
  const inactiveParticipants = filteredBySearch.filter(p => !isIncludedThisSeason(p))
  const visibleParticipants = subTab === 'active' ? activeParticipants : inactiveParticipants

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

  return (
    <div className="fade-in space-y-5">
      {showImport && (
        <ImportParticipants
          onImport={importParticipants}
          onClose={() => setShowImport(false)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Participants</h2>
          <p className="text-stone-500 text-sm">{participants.length} registered</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
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
                  <div className="flex items-center gap-1.5">
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
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Gender badge */}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold border ${gc.bg} ${gc.text} ${gc.border}`}>
                    {g === 'm' ? 'M' : g === 'f' ? 'F' : 'NB'}
                  </span>
                  {p.medicalType?.includes('Allergy') && <span className="badge-allergy">A</span>}
                  {p.medicalType?.includes('Dietary') && <span className="badge-dietary">D</span>}
                  {p.medicalType?.includes('Medical') && <span className="badge-medical">M</span>}
                  {p.sendNeeds && <span className="badge-send">S</span>}
                  {p.safeguardingFlag && <SafeguardingFlagIcon className="px-2 py-0.5" size={11} />}
                  {!isIncludedThisSeason(p) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                      Not Included
                    </span>
                  )}
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
