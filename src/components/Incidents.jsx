import { useState } from 'react'
import { AlertTriangle, Plus, FileText, Search, ChevronRight, Trash2, Mail } from 'lucide-react'
import IncidentForm from './IncidentForm'

export default function Incidents({ incidents, setIncidents, participants, staffList = [], onView }) {
  const [showForm, setShowForm] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState('')
  const [search, setSearch] = useState('')

  function addIncident(data) {
    if (!selectedParticipant) return
    setIncidents(prev => [
      ...prev,
      { ...data, id: crypto.randomUUID(), participantId: selectedParticipant, createdAt: new Date().toISOString() },
    ])
    setShowForm(false)
    setSelectedParticipant('')
  }

  function deleteIncident(id) {
    if (window.confirm('Delete this incident? This cannot be undone.')) {
      setIncidents(prev => prev.filter(inc => inc.id !== id))
    }
  }

  const filtered = incidents
    .filter(inc => {
      const p = participants.find(x => x.id === inc.participantId)
      return !search || p?.name.toLowerCase().includes(search.toLowerCase())
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Incidents & Accidents</h2>
          <p className="text-stone-500 text-sm">{incidents.length} total logged</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-2">
          <Plus size={15} strokeWidth={2.5} /> Log Incident
        </button>
      </div>

      {/* New incident form */}
      {showForm && (
        <div className="card border-2 border-amber-200 fade-in">
          <h3 className="font-display font-semibold text-forest-950 mb-3">Select Participant</h3>
          <div className="mb-4">
            <label className="label">Participant *</label>
            <select className="input" value={selectedParticipant} onChange={e => setSelectedParticipant(e.target.value)}>
              <option value="">— Choose participant —</option>
              {[...participants].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.age ? ` (Age ${p.age})` : ''}</option>
              ))}
            </select>
          </div>
          {selectedParticipant && (
            <IncidentForm
              participantId={selectedParticipant}
              staffList={staffList}
              onSave={addIncident}
              onCancel={() => { setShowForm(false); setSelectedParticipant('') }}
            />
          )}
          {!selectedParticipant && (
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input type="text" placeholder="Search by participant name..." value={search}
          onChange={e => setSearch(e.target.value)} className="input pl-9" />
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
        <div className="space-y-3">
          {filtered.map(inc => {
            const p = participants.find(x => x.id === inc.participantId)
            return (
              <div key={inc.id} className="card hover:shadow-sm transition-shadow group cursor-pointer"
                onClick={() => p && onView(p.id)}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 bg-amber-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-display font-semibold text-forest-950 group-hover:text-forest-700">
                        {p?.name || 'Unknown Participant'}
                      </span>
                      <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{inc.type}</span>
                      {inc.staffMember && <span className="text-xs text-stone-500">· {inc.staffMember}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-400">
                        {new Date(inc.createdAt).toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {inc.pdfName && (
                        <span className="flex items-center gap-1 text-xs text-forest-700 font-medium">
                          <FileText size={11} /> {inc.pdfName}
                          {inc.pdfData && (
                            <a href={inc.pdfData} download={inc.pdfName}
                              onClick={e => e.stopPropagation()} className="ml-1 underline hover:text-forest-900">
                              Download
                            </a>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {p?.parentEmail && (
                      <button onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          const response = await fetch('/.netlify/functions/send-incident-email', {
                            method: 'POST',
                            body: JSON.stringify({ incident: inc, participant: p }),
                          })
                          const result = await response.json()
                          if (result.success) {
                            alert('Email sent successfully!')
                          } else {
                            alert('Failed to send email: ' + result.error)
                          }
                        } catch (error) {
                          alert('Error sending email: ' + error.message)
                        }
                      }}
                        className="p-1.5 text-stone-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Email parent">
                        <Mail size={15} />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteIncident(inc.id) }}
                      className="p-1.5 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={15} />
                    </button>
                    <ChevronRight size={16} className="text-stone-300 group-hover:text-stone-500 mt-1" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
