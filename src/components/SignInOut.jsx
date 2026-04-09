import { useState } from 'react'
import { LogIn, LogOut, Clock, CheckCircle, Search, RotateCcw, User, X } from 'lucide-react'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function parseApprovedAdults(str) {
  if (!str) return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

function CollectionModal({ participant, onConfirm, onCancel }) {
  const adults = parseApprovedAdults(participant.approvedAdults)
  const [selected, setSelected] = useState(null)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-in">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <h3 className="font-display font-bold text-forest-950">Sign Out</h3>
            <p className="text-sm text-stone-500 mt-0.5">{participant.name}</p>
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          {adults.length > 0 ? (
            <>
              <p className="text-sm font-medium text-stone-700">Who is collecting?</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {adults.map((adult, i) => (
                  <button key={i} onClick={() => setSelected(adult)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selected === adult ? 'border-forest-600 bg-forest-50' : 'border-stone-200 hover:border-stone-300'
                    }`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display flex-shrink-0 ${
                      selected === adult ? 'bg-forest-900 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>{i + 1}</div>
                    <span className="text-sm font-medium text-stone-800">{adult}</span>
                  </button>
                ))}
                <button onClick={() => setSelected('Other / not on approved list')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                    selected === 'Other / not on approved list' ? 'border-amber-500 bg-amber-50' : 'border-dashed border-stone-200 hover:border-stone-300'
                  }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selected === 'Other / not on approved list' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-400'
                  }`}><User size={13} /></div>
                  <span className="text-sm text-stone-500 italic">Other / not on approved list</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-stone-500">No approved adults recorded for this participant.</p>
              <p className="text-xs text-stone-400 mt-1">Add them via the Participants page.</p>
            </div>
          )}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={() => onConfirm(selected || 'Not recorded')}
            disabled={adults.length > 0 && !selected}
            className={`flex-1 btn-primary py-3 ${adults.length > 0 && !selected ? 'opacity-40 cursor-not-allowed' : ''}`}>
            Confirm Sign Out
          </button>
          <button onClick={onCancel} className="btn-secondary px-4">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function SignInOut({ participants, attendance, setAttendance }) {
  const [search, setSearch] = useState('')
  const [flash, setFlash] = useState(null)
  const [collectingFor, setCollectingFor] = useState(null)
  const today = todayKey()
  const todayRecords = attendance.filter(a => a.date === today)

  function getRecord(participantId) {
    return todayRecords.find(r => r.participantId === participantId) || null
  }

  function signIn(participant) {
    const now = new Date().toISOString()
    setAttendance(prev => [
      ...prev.filter(r => !(r.date === today && r.participantId === participant.id)),
      { participantId: participant.id, date: today, signIn: now, signOut: null, collectedBy: null, id: `${participant.id}-${today}` }
    ])
    setFlash({ id: participant.id, type: 'in' })
    setTimeout(() => setFlash(null), 2000)
  }

  function undoSignIn(participant) {
    if (!window.confirm(`Undo sign-in for ${participant.name}?`)) return
    setAttendance(prev => prev.filter(r => !(r.date === today && r.participantId === participant.id)))
  }

  function undoSignOut(participant) {
    if (!window.confirm(`Undo sign-out for ${participant.name}? They will show as still on site.`)) return
    const existing = getRecord(participant.id)
    setAttendance(prev => prev.map(r => r.id === existing.id ? { ...r, signOut: null, collectedBy: null } : r))
  }

  function confirmSignOut(collectedBy) {
    const participant = collectingFor
    setCollectingFor(null)
    const existing = getRecord(participant.id)
    if (!existing) return
    const now = new Date().toISOString()
    setAttendance(prev => prev.map(r => r.id === existing.id ? { ...r, signOut: now, collectedBy } : r))
    setFlash({ id: participant.id, type: 'out' })
    setTimeout(() => setFlash(null), 2000)
  }

  // Alphabetical by first name
  const sorted = [...participants].sort((a, b) => a.name.localeCompare(b.name))
  const filtered = sorted.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const onSite = participants.filter(p => { const r = getRecord(p.id); return r?.signIn && !r?.signOut })
  const notArrived = participants.filter(p => !getRecord(p.id)?.signIn)

  return (
    <div className="fade-in space-y-4">
      {collectingFor && (
        <CollectionModal participant={collectingFor} onConfirm={confirmSignOut} onCancel={() => setCollectingFor(null)} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Sign In / Out</h2>
          <p className="text-stone-500 text-sm">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2 text-center">
          <div className="card px-3 py-2">
            <p className="text-xl font-display font-bold text-amber-500">{onSite.length}</p>
            <p className="text-xs text-stone-500">On site</p>
          </div>
          <div className="card px-3 py-2">
            <p className="text-xl font-display font-bold text-stone-400">{notArrived.length}</p>
            <p className="text-xs text-stone-500">Expected</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input type="text" placeholder="Search participants..." value={search}
          onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      {participants.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-stone-400 text-sm">No participants registered yet.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-500 uppercase tracking-wide">
            <span>Participant</span>
            <span className="text-right w-24">Sign In</span>
            <span className="text-right w-24">Sign Out</span>
            <span className="text-right w-28">Action</span>
          </div>

          <div className="divide-y divide-stone-50">
            {filtered.map(p => {
              const rec = getRecord(p.id)
              const isIn = rec?.signIn && !rec?.signOut
              const isOut = !!rec?.signOut
              const isFlashing = flash?.id === p.id

              const hasAllergy = p.medicalType?.includes('Allergy')
              const hasMedical = p.medicalType?.includes('Medical') || p.medicalType?.includes('Dietary')
              const hasSend = !!p.sendNeeds

              return (
                <div key={p.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-4 py-3 transition-all ${
                    isFlashing ? 'bg-amber-50' : isIn ? 'bg-amber-50/40' : isOut ? 'bg-stone-50/60 opacity-75' : ''
                  }`}>

                  {/* Name + flags */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-semibold text-forest-950 text-sm">{p.name}</span>
                      {hasAllergy && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">A</span>
                      )}
                      {hasMedical && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">M</span>
                      )}
                      {hasSend && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">S</span>
                      )}
                      {isIn && <CheckCircle size={13} className="text-amber-500" />}
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {p.pronouns}{p.age ? ` · Age ${p.age}` : ''}
                      {rec?.collectedBy && !rec.signOut === false && (
                        <span className="ml-2 text-stone-500">· Collected by {rec.collectedBy}</span>
                      )}
                      {isOut && rec?.collectedBy && (
                        <span className="ml-2 text-stone-500">· {rec.collectedBy}</span>
                      )}
                    </p>
                  </div>

                  {/* Sign in time */}
                  <div className="text-right w-24">
                    <span className={`text-xs font-mono ${rec?.signIn ? 'text-green-700 font-semibold' : 'text-stone-300'}`}>
                      {fmt(rec?.signIn)}
                    </span>
                  </div>

                  {/* Sign out time */}
                  <div className="text-right w-24">
                    <span className={`text-xs font-mono ${rec?.signOut ? 'text-blue-700 font-semibold' : 'text-stone-300'}`}>
                      {fmt(rec?.signOut)}
                    </span>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-1.5 justify-end w-28">
                    {!rec?.signIn && (
                      <button onClick={() => signIn(p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-amber-500 hover:bg-amber-600 text-white active:scale-95 transition-all">
                        <LogIn size={12} /> In
                      </button>
                    )}
                    {rec?.signIn && !rec?.signOut && (
                      <>
                        <button onClick={() => undoSignIn(p)} title="Undo sign-in"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-all">
                          <RotateCcw size={13} />
                        </button>
                        <button onClick={() => setCollectingFor(p)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-semibold bg-forest-900 hover:bg-forest-800 text-white active:scale-95 transition-all">
                          <LogOut size={12} /> Out
                        </button>
                      </>
                    )}
                    {rec?.signOut && (
                      <button onClick={() => undoSignOut(p)} title="Undo sign-out"
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display font-medium bg-stone-100 hover:bg-red-100 hover:text-red-700 text-stone-500 active:scale-95 transition-all">
                        <RotateCcw size={12} /> Undo
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Key */}
      <div className="flex gap-3 flex-wrap text-xs text-stone-500">
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-red-100 text-red-700 border border-red-200">A</span> Allergy</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-blue-100 text-blue-700 border border-blue-200">M</span> Medical / Dietary</span>
        <span className="flex items-center gap-1"><span className="font-bold px-1 rounded bg-purple-100 text-purple-700 border border-purple-200">S</span> SEND / Support</span>
      </div>
    </div>
  )
}
