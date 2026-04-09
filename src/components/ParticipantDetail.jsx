import { useState } from 'react'
import { ArrowLeft, Edit2, Clock, AlertTriangle, Phone, Mail, User, FileText } from 'lucide-react'
import ParticipantForm from './ParticipantForm'
import IncidentForm from './IncidentForm'

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const TABS = ['Overview', 'Medical', 'SEND / Support', 'Attendance', 'Incidents']

export default function ParticipantDetail({
  participant, participants, setParticipants,
  attendance, incidents, setIncidents, onBack
}) {
  const [editing, setEditing] = useState(false)
  const [showIncident, setShowIncident] = useState(false)
  const [activeTab, setActiveTab] = useState('Overview')

  if (!participant) return (
    <div className="fade-in">
      <button onClick={onBack} className="btn-secondary flex items-center gap-2 mb-4">
        <ArrowLeft size={15} /> Back
      </button>
      <p className="text-stone-500">Participant not found.</p>
    </div>
  )

  function saveEdit(data) {
    setParticipants(prev => prev.map(p => p.id === participant.id ? { ...p, ...data } : p))
    setEditing(false)
  }

  function addIncident(data) {
    setIncidents(prev => [...prev, {
      ...data, id: crypto.randomUUID(),
      participantId: participant.id,
      createdAt: new Date().toISOString()
    }])
    setShowIncident(false)
  }

  const participantAttendance = attendance
    .filter(a => a.participantId === participant.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const participantIncidents = incidents
    .filter(i => i.participantId === participant.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const hasMedical = participant.medicalType?.length > 0 || participant.medicalDetails
  const hasSend = !!participant.sendNeeds

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
      <div className="flex items-start justify-between">
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
            <h2 className="text-2xl font-display font-bold text-forest-950">{participant.name}</h2>
            <p className="text-stone-500 text-sm">
              {[participant.pronouns, participant.age ? `Age ${participant.age}` : null, participant.role].filter(Boolean).join(' · ')}
            </p>
            {participant.dressingRoom && (
              <p className="text-xs text-stone-400 mt-0.5">Dressing Room: {participant.dressingRoom}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {participant.medicalType?.includes('Allergy') && <span className="badge-allergy">⚠ Allergy</span>}
          {participant.medicalType?.includes('Medical') && <span className="badge-medical">+ Medical</span>}
          {participant.medicalType?.includes('Dietary') && <span className="badge-dietary">🌿 Dietary</span>}
          {participant.sendNeeds && <span className="badge-send">★ SEND / Support</span>}
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
          </div>
        )}

        {/* MEDICAL */}
        {activeTab === 'Medical' && (
          <div className="card">
            <h3 className="font-display font-semibold text-forest-950 mb-4">Medical & Dietary</h3>
            {hasMedical ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {participant.medicalType?.map(t => (
                    <span key={t} className={
                      t === 'Allergy' ? 'badge-allergy text-sm px-3 py-1' :
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
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-stone-400 text-sm">No medical or dietary requirements recorded.</p>
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
              <div className="bg-purple-50 rounded-xl p-4 text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">
                {participant.sendNeeds}
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
              <h3 className="font-display font-semibold text-forest-950 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" /> Incidents & Accidents
              </h3>
              <button onClick={() => setShowIncident(s => !s)} className="btn-secondary text-xs flex items-center gap-1.5 py-1.5">
                + Log Incident
              </button>
            </div>

            {showIncident && (
              <IncidentForm
                participantId={participant.id}
                onSave={addIncident}
                onCancel={() => setShowIncident(false)}
              />
            )}

            {participantIncidents.length === 0 ? (
              <p className="text-stone-400 text-sm text-center py-6">No incidents recorded.</p>
            ) : (
              <div className="space-y-3">
                {participantIncidents.map(inc => (
                  <div key={inc.id} className="border border-stone-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        inc.severity === 'high' ? 'bg-red-100 text-red-700' :
                        inc.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {inc.severity?.toUpperCase()} — {inc.type}
                      </span>
                      <span className="text-xs text-stone-400">
                        {new Date(inc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-stone-700 leading-relaxed">{inc.description}</p>
                    {inc.action && (
                      <p className="text-xs text-stone-500 mt-2">
                        <strong>Action taken:</strong> {inc.action}
                      </p>
                    )}
                    {inc.pdfName && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-forest-700">
                        <FileText size={12} />
                        <span>{inc.pdfName}</span>
                        {inc.pdfData && (
                          <a href={inc.pdfData} download={inc.pdfName} className="ml-1 underline hover:text-forest-900">
                            Download
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
