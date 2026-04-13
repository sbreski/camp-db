import { useState } from 'react'
import { Plus, Search, ChevronRight, Trash2, User, Upload, CameraOff, Camera } from 'lucide-react'
import ParticipantForm from './ParticipantForm'
import ImportParticipants from './ImportParticipants'
import ParticipantNameText from './ParticipantNameText'
import SafeguardingFlagIcon from './SafeguardingFlagIcon'

function photoConsentMode(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'no') return 'no'
  if (normalized === 'internal') return 'internal'
  return 'ok'
}

export default function Participants({ participants, setParticipants, onView }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([])

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

  const filtered = [...participants]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const selectedSet = new Set(selectedParticipantIds)
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedSet.has(p.id))

  function isIncludedThisSeason(participant) {
    const flag = participant.isActiveThisSeason ?? participant.is_active_this_season
    if (typeof flag === 'string') return flag.toLowerCase() !== 'false'
    return flag !== false
  }

  function toggleParticipantSelection(participantId) {
    setSelectedParticipantIds(prev => (
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    ))
  }

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map(p => p.id))
      setSelectedParticipantIds(prev => prev.filter(id => !filteredIds.has(id)))
      return
    }
    setSelectedParticipantIds(prev => [...new Set([...prev, ...filtered.map(p => p.id)])])
  }

  function clearSelection() {
    setSelectedParticipantIds([])
  }

  function setIncludedForSelected(isIncluded) {
    if (selectedParticipantIds.length === 0) {
      alert('Select at least one participant first.')
      return
    }

    setParticipants(prev => prev.map(participant => (
      selectedSet.has(participant.id)
        ? { ...participant, isActiveThisSeason: isIncluded }
        : participant
    )))
  }

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
        <input type="text" placeholder="Search by name..." value={search}
          onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      {participants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={toggleSelectAllFiltered} className="btn-secondary text-xs py-1.5">
            {allFilteredSelected ? 'Unselect All' : 'Select All'}
          </button>
          <button onClick={() => setIncludedForSelected(true)} className="btn-primary text-xs py-1.5" disabled={selectedParticipantIds.length === 0}>
            Included
          </button>
          <button onClick={() => setIncludedForSelected(false)} className="btn-secondary text-xs py-1.5" disabled={selectedParticipantIds.length === 0}>
            Not Included
          </button>
          <button onClick={clearSelection} className="btn-secondary text-xs py-1.5" disabled={selectedParticipantIds.length === 0}>
            Clear
          </button>
          <span className="text-xs text-stone-500">{selectedParticipantIds.length} selected</span>
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
          {filtered.map(p => (
            <div key={p.id} className="card flex items-center gap-4 hover:shadow-sm transition-shadow group">
              <input
                type="checkbox"
                checked={selectedSet.has(p.id)}
                onChange={() => toggleParticipantSelection(p.id)}
                className="h-4 w-4 flex-shrink-0"
                aria-label={`Select ${participantDisplayName(p)}`}
              />
              <div onClick={() => onView(p.id)}
                className="w-10 h-10 rounded-full bg-forest-900 flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0 cursor-pointer">
                {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(p.id)}>
                <div className="flex items-center gap-1.5">
                  <ParticipantNameText participant={p} className="font-display font-semibold text-forest-950 group-hover:text-forest-700" />
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
                {p.medicalType?.includes('Allergy') && <span className="badge-allergy">A</span>}
                {p.medicalType?.includes('Dietary') && <span className="badge-dietary">D</span>}
                {p.medicalType?.includes('Medical') && <span className="badge-medical">M</span>}
                {p.sendNeeds && <span className="badge-send">S</span>}
                {p.safeguardingFlag && <SafeguardingFlagIcon className="px-2 py-0.5" size={11} />}
                {!isIncludedThisSeason(p) && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">Not Included</span>}
              </div>
              <button onClick={() => deleteParticipant(p.id)}
                className="p-1.5 text-stone-400 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <Trash2 size={15} />
              </button>
              <button onClick={() => onView(p.id)} className="text-stone-400 hover:text-forest-700 transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
