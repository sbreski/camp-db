import { useState } from 'react'
import { Plus, Search, ChevronRight, Trash2, User, Upload } from 'lucide-react'
import ParticipantForm from './ParticipantForm'
import ImportParticipants from './ImportParticipants'

export default function Participants({ participants, setParticipants, onView }) {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)

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

  return (
    <div className="fade-in space-y-5">
      {showImport && (
        <ImportParticipants
          onImport={importParticipants}
          onClose={() => setShowImport(false)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Participants</h2>
          <p className="text-stone-500 text-sm">{participants.length} registered</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
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
              <div onClick={() => onView(p.id)}
                className="w-10 h-10 rounded-full bg-forest-900 flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0 cursor-pointer">
                {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(p.id)}>
                <p className="font-display font-semibold text-forest-950 group-hover:text-forest-700">{p.name}</p>
                <p className="text-xs text-stone-400 truncate">
                  {[p.pronouns, p.age ? `Age ${p.age}` : null, p.role].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {p.medicalType?.includes('Allergy') && <span className="badge-allergy">A</span>}
                {p.medicalType?.includes('Medical') && <span className="badge-medical">M</span>}
                {p.medicalType?.includes('Dietary') && <span className="badge-dietary">D</span>}
                {p.sendNeeds && <span className="badge-send">S</span>}
              </div>
              <button onClick={() => deleteParticipant(p.id)}
                className="p-1.5 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
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
