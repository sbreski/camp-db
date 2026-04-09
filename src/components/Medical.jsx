import { Search } from 'lucide-react'
import { useState } from 'react'

export default function Medical({ participants, onView }) {
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  const medParticipants = participants.filter(p =>
    (p.medicalType?.length > 0 || p.sendNeeds) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const filtered = filter === 'All'
    ? medParticipants
    : filter === 'SEND'
    ? medParticipants.filter(p => p.sendNeeds)
    : medParticipants.filter(p => p.medicalType?.includes(filter))

  const counts = {
    All: medParticipants.length,
    Allergy: participants.filter(p => p.medicalType?.includes('Allergy')).length,
    Medical: participants.filter(p => p.medicalType?.includes('Medical')).length,
    Dietary: participants.filter(p => p.medicalType?.includes('Dietary')).length,
    SEND: participants.filter(p => p.sendNeeds).length,
  }

  return (
    <div className="fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-display font-bold text-forest-950">Medical & Support</h2>
        <p className="text-stone-500 text-sm">{counts.All} participants with flagged needs</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(counts).map(([label, count]) => (
          <button
            key={label}
            onClick={() => setFilter(label)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-display font-medium transition-all ${
              filter === label
                ? 'bg-forest-900 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
            }`}
          >
            {label} <span className="ml-1 opacity-70">({count})</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-stone-400 text-sm">No participants match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div
              key={p.id}
              className="card hover:shadow-sm transition-shadow cursor-pointer group"
              onClick={() => onView(p.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-display font-semibold text-forest-950 group-hover:text-forest-700">{p.name}</p>
                  <p className="text-xs text-stone-400">{p.pronouns}{p.age ? ` · Age ${p.age}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {p.medicalType?.map(t => (
                    <span key={t} className={
                      t === 'Allergy' ? 'badge-allergy' : t === 'Medical' ? 'badge-medical' : 'badge-dietary'
                    }>{t}</span>
                  ))}
                  {p.sendNeeds && <span className="badge-send">SEND</span>}
                </div>
              </div>
              {p.medicalDetails && (
                <div className="mt-2 p-3 bg-stone-50 rounded-lg text-sm text-stone-700 leading-relaxed">
                  {p.medicalDetails}
                </div>
              )}
              {p.sendNeeds && (
                <div className="mt-2 p-3 bg-purple-50 rounded-lg text-sm text-purple-900 leading-relaxed">
                  <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Support Needs</p>
                  {p.sendNeeds}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
