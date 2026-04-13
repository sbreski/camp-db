import { useState } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, AlertCircle, X } from 'lucide-react'
import ParticipantNameText, { participantDisplayName } from './ParticipantNameText'

function fmtTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function weekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function duration(signIn, signOut) {
  if (!signIn || !signOut) return null
  const mins = Math.round((new Date(signOut) - new Date(signIn)) / 60000)
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function lateMinutes(signIn, threshold = '10:15') {
  if (!signIn) return null
  const t = new Date(signIn)
  const [h, m] = threshold.split(':').map(Number)
  const cutoff = new Date(t)
  cutoff.setHours(h, m, 0, 0)
  const diff = Math.round((t - cutoff) / 60000)
  return diff > 0 ? diff : 0
}

function parseCollectionDetails(collectedBy) {
  if (!collectedBy) {
    return { summary: '—', hasReason: false, fullName: '', reason: '' }
  }
  const otherMatch = collectedBy.match(/^Other \(not approved\):\s*(.+?)\s*-\s*Reason:\s*(.+)$/i)
  if (!otherMatch) {
    return { summary: collectedBy, hasReason: false, fullName: '', reason: '' }
  }
  return {
    summary: `Other: ${otherMatch[1].trim()}`,
    hasReason: true,
    fullName: otherMatch[1].trim(),
    reason: otherMatch[2].trim(),
  }
}

const ATTENDANCE_REASON_LABELS = {
  illness: 'Illness',
  holiday: 'Holiday',
  no_show: 'No-show',
  late_arrival: 'Late arrival',
  early_leave: 'Early leave',
  other: 'Other',
}

function attendanceReasonLabel(value) {
  return ATTENDANCE_REASON_LABELS[value] || null
}

// ─── Daily Overview ───────────────────────────────────────────────────────────
function DailyOverview({ participants, attendance, startEditTime, openCollectionDetail }) {
  const [date, setDate] = useState(todayKey())
  const records = attendance.filter(a => a.date === date)

  const rows = [...participants]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => ({ p, rec: records.find(r => r.participantId === p.id) || null }))

  const present = rows.filter(r => r.rec?.signIn).length
  const absent = rows.filter(r => !r.rec?.signIn).length
  const lateCount = rows.filter(r => lateMinutes(r.rec?.signIn) > 0).length

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="flex items-center gap-3">
        <button onClick={() => setDate(addDays(date, -1))} className="btn-secondary px-2 py-2"><ChevronLeft size={16} /></button>
        <div className="flex-1 text-center">
          <p className="font-display font-semibold text-forest-950">{fmtDate(date)}</p>
          {date === todayKey() && <p className="text-xs text-amber-600 font-medium">Today</p>}
        </div>
        <button onClick={() => setDate(addDays(date, 1))} disabled={date >= todayKey()}
          className="btn-secondary px-2 py-2 disabled:opacity-30"><ChevronRight size={16} /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Present', value: present, color: 'text-green-600' },
          { label: 'Absent', value: absent, color: 'text-red-500' },
          { label: 'Late arrivals', value: lateCount, color: 'text-amber-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center py-3">
            <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-500 uppercase tracking-wide">
          <span>Participant</span>
          <span className="w-20 text-right">Sign In</span>
          <span className="w-20 text-right">Sign Out</span>
          <span className="w-20 text-right">Duration</span>
          <span className="w-28 text-right">Collected by</span>
        </div>
        <div className="divide-y divide-stone-50">
          {rows.map(({ p, rec }) => {
            const late = lateMinutes(rec?.signIn)
            const collection = parseCollectionDetails(rec?.collectedBy)
            const reasonLabel = attendanceReasonLabel(rec?.exceptionReason || rec?.exception_reason)
            const reasonNotes = rec?.exceptionNotes || rec?.exception_notes || ''
            return (
              <div key={p.id} className={`sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] sm:gap-2 sm:items-center px-4 py-2.5 ${!rec?.signIn ? 'opacity-50 bg-red-50/30' : ''}`}>
                <div>
                  <ParticipantNameText participant={p} className="text-sm font-medium text-forest-950" />
                  {late > 0 && (
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      <AlertCircle size={10} /> {late} min late
                    </p>
                  )}
                  {!rec?.signIn && <p className="text-xs text-red-500">Absent</p>}
                  {reasonLabel && (
                    <p className="text-xs text-amber-700 mt-1">
                      Reason: <span className="font-medium">{reasonLabel}</span>{reasonNotes ? ` - ${reasonNotes}` : ''}
                    </p>
                  )}
                </div>
                {rec?.signIn ? (
                  <button
                    className="w-full sm:w-20 text-right text-xs font-mono text-green-700 font-semibold cursor-pointer hover:bg-green-50 px-1 rounded transition-colors mt-2 sm:mt-0"
                    onClick={() => startEditTime(rec.id, 'signIn', rec.signIn, date)}
                  >
                    {fmtTime(rec.signIn)}
                  </button>
                ) : (
                  <span className="w-full sm:w-20 text-right text-xs font-mono text-stone-300 mt-2 sm:mt-0 block">{fmtTime(rec?.signIn)}</span>
                )}
                {rec?.signOut ? (
                  <button
                    className="w-full sm:w-20 text-right text-xs font-mono text-blue-700 font-semibold cursor-pointer hover:bg-blue-50 px-1 rounded transition-colors mt-1 sm:mt-0"
                    onClick={() => startEditTime(rec.id, 'signOut', rec.signOut, date)}
                  >
                    {fmtTime(rec.signOut)}
                  </button>
                ) : (
                  <span className="w-full sm:w-20 text-right text-xs font-mono text-stone-300 mt-1 sm:mt-0 block">{fmtTime(rec?.signOut)}</span>
                )}
                <span className="w-full sm:w-20 text-right text-xs text-stone-500 mt-1 sm:mt-0 block">{duration(rec?.signIn, rec?.signOut) || (rec?.signIn ? <span className="text-amber-600">On site</span> : '—')}</span>
                {collection.hasReason ? (
                  <button
                    className="w-full sm:w-28 text-right text-xs text-stone-600 hover:bg-stone-100 px-1 rounded transition-colors truncate mt-1 sm:mt-0 block"
                    onClick={() => openCollectionDetail({ fullName: collection.fullName, reason: collection.reason, participantName: participantDisplayName(p), date })}
                    title="View collector reason"
                  >
                    {collection.summary} (view)
                  </button>
                ) : (
                  <span className="w-full sm:w-28 text-right text-xs text-stone-600 truncate mt-1 sm:mt-0 block">{collection.summary}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Weekly Overview ──────────────────────────────────────────────────────────
function WeeklyOverview({ participants, attendance, startEditTime, markPresent, markAbsent }) {
  const [weekOf, setWeekOf] = useState(weekStart(todayKey()))
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i)) // Mon–Sun

  function prevWeek() { setWeekOf(addDays(weekOf, -7)) }
  function nextWeek() { setWeekOf(addDays(weekOf, 7)) }

  const sorted = [...participants].sort((a, b) => a.name.localeCompare(b.name))

  const stats = days.map(day => {
    const recs = attendance.filter(a => a.date === day)
    return {
      day,
      present: recs.filter(r => r.signIn).length,
      late: recs.filter(r => lateMinutes(r.signIn) > 0).length,
    }
  })

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevWeek} className="btn-secondary px-2 py-2"><ChevronLeft size={16} /></button>
        <div className="flex-1 text-center">
          <p className="font-display font-semibold text-forest-950">
            Week of {fmtDate(weekOf)}
          </p>
        </div>
        <button onClick={nextWeek} className="btn-secondary px-2 py-2"><ChevronRight size={16} /></button>
      </div>

      {/* Weekly summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {stats.map(({ day, present, late }) => (
          <div key={day} className={`card text-center py-2 px-1 ${day === todayKey() ? 'ring-2 ring-amber-400' : ''}`}>
            <p className="text-xs font-semibold text-stone-500">{new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}</p>
            <p className="text-xs text-stone-400">{new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
            <p className="text-lg font-display font-bold text-forest-900 mt-1">{present}</p>
            <p className="text-xs text-stone-400">present</p>
            {late > 0 && <p className="text-xs text-amber-500 mt-0.5">{late} late</p>}
          </div>
        ))}
      </div>

      {/* Grid: participant × day */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-100">
              <th className="text-left px-4 py-2.5 text-stone-500 font-semibold uppercase tracking-wide w-36">Participant</th>
              {days.map(day => (
                <th key={day} className={`px-2 py-2.5 text-center text-stone-500 font-semibold uppercase tracking-wide min-w-[80px] ${day === todayKey() ? 'bg-amber-50' : ''}`}>
                  <div>{new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                  <div className="font-normal text-stone-400">{new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                </th>
              ))}
              <th className="px-3 py-2.5 text-center text-stone-500 font-semibold uppercase tracking-wide">Days</th>
              <th className="px-3 py-2.5 text-center text-stone-500 font-semibold uppercase tracking-wide">Late</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {sorted.map(p => {
              let totalDays = 0, totalLate = 0
              return (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2 font-medium text-forest-950 whitespace-nowrap"><ParticipantNameText participant={p} className="font-medium text-forest-950" /></td>
                  {days.map(day => {
                    const rec = attendance.find(a => a.participantId === p.id && a.date === day)
                    const late = lateMinutes(rec?.signIn)
                    if (rec?.signIn) totalDays++
                    if (late > 0) totalLate++
                    return (
                      <td key={day} className={`px-2 py-2 text-center ${day === todayKey() ? 'bg-amber-50' : ''}`}>
                        {rec?.signIn ? (
                          <div>
                            <button
                              className={`inline-block w-6 h-6 rounded-full text-xs font-bold leading-6 transition-colors ${late > 0 ? 'bg-amber-100 text-amber-700 hover:bg-red-100 hover:text-red-600' : 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600'}`}
                              onClick={() => markAbsent(p.id, day)}
                              title="Mark absent"
                            >
                              {late > 0 ? 'L' : '✓'}
                            </button>
                            <button
                              className="text-stone-400 mt-0.5 font-mono text-xs hover:bg-stone-100 px-1 rounded cursor-pointer transition-colors"
                              onClick={() => startEditTime(rec.id, 'signIn', rec.signIn, day)}
                            >
                              {fmtTime(rec.signIn)}
                            </button>
                          </div>
                        ) : (
                          <button
                            className="inline-flex flex-col items-center gap-0.5"
                            onClick={() => markPresent(p.id, day)}
                            title="Mark present"
                          >
                            <span className="inline-block w-6 h-6 rounded-full bg-red-50 text-red-400 text-xs font-bold leading-6 hover:bg-green-100 hover:text-green-700 transition-colors">✗</span>
                          </button>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-center font-semibold text-forest-900">{totalDays}/7</td>
                  <td className="px-3 py-2 text-center">
                    {totalLate > 0
                      ? <span className="font-semibold text-amber-600">{totalLate}</span>
                      : <span className="text-stone-300">0</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 text-xs text-stone-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs">✓</span> Present on time</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">L</span> Late (&gt;10:15)</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-red-50 text-red-400 flex items-center justify-center font-bold text-xs">✗</span> Absent</span>
      </div>
    </div>
  )
}

// ─── Participant Overview ─────────────────────────────────────────────────────
function ParticipantOverview({ participants, attendance, startEditTime, openCollectionDetail }) {
  const [selectedId, setSelectedId] = useState(participants[0]?.id || '')
  const participant = participants.find(p => p.id === selectedId)

  const records = attendance
    .filter(a => a.participantId === selectedId)
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const totalDays = records.filter(r => r.signIn).length
  const totalLate = records.filter(r => lateMinutes(r.signIn) > 0).length
  const totalAbsent = records.length - totalDays
  const avgArrival = (() => {
    const times = records.filter(r => r.signIn).map(r => {
      const d = new Date(r.signIn)
      return d.getHours() * 60 + d.getMinutes()
    })
    if (!times.length) return null
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    return `${String(Math.floor(avg / 60)).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`
  })()

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Select Participant</label>
        <select className="input max-w-xs" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          {[...participants].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
            <option key={p.id} value={p.id}>{participantDisplayName(p)}</option>
          ))}
        </select>
      </div>

      {participant && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Days attended', value: totalDays, color: 'text-green-600' },
              { label: 'Late arrivals', value: totalLate, color: 'text-amber-500' },
              { label: 'Absences', value: totalAbsent, color: 'text-red-500' },
              { label: 'Avg arrival', value: avgArrival || '—', color: 'text-forest-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card text-center py-3">
                <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
                <p className="text-xs text-stone-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Trend chart (simple visual) */}
          {records.length > 0 && (
            <div className="card">
              <h4 className="font-display font-semibold text-forest-950 mb-3 flex items-center gap-2">
                <TrendingUp size={15} className="text-forest-600" /> Arrival Times
              </h4>
              <div className="space-y-2">
                {records.filter(r => r.signIn).map(r => {
                  const late = lateMinutes(r.signIn)
                  const barWidth = late > 0 ? Math.min(late / 30 * 100, 100) : 0
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className="text-xs text-stone-500 w-20 flex-shrink-0">{fmtDate(r.date)}</span>
                      {r.signIn ? (
                        <button
                          className={`text-xs font-mono font-semibold w-12 flex-shrink-0 cursor-pointer hover:bg-stone-100 px-1 rounded transition-colors ${late > 0 ? 'text-amber-600' : 'text-green-600'}`}
                          onClick={() => startEditTime(r.id, 'signIn', r.signIn, r.date)}
                        >
                          {fmtTime(r.signIn)}
                        </button>
                      ) : (
                        <span className="text-xs font-mono font-semibold w-12 flex-shrink-0 text-stone-300">
                          {fmtTime(r.signIn)}
                        </span>
                      )}
                      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                        {late > 0 ? (
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${barWidth}%` }} />
                        ) : (
                          <div className="h-full bg-green-400 rounded-full w-2" />
                        )}
                      </div>
                      {late > 0 && <span className="text-xs text-amber-600 w-16 flex-shrink-0">{late} min late</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Full history table */}
          <div className="card p-0 overflow-hidden">
            <div className="hidden sm:grid sm:grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-500 uppercase tracking-wide">
              <span className="w-28">Date</span>
              <span>In</span><span>Out</span><span>Duration</span><span>Collected by</span>
            </div>
            <div className="divide-y divide-stone-50">
              {records.length === 0 ? (
                <p className="text-center text-stone-400 text-sm py-6">No attendance recorded.</p>
              ) : records.map(r => {
                const late = lateMinutes(r.signIn)
                const collection = parseCollectionDetails(r.collectedBy)
                const reasonLabel = attendanceReasonLabel(r?.exceptionReason || r?.exception_reason)
                const reasonNotes = r?.exceptionNotes || r?.exception_notes || ''
                return (
                  <div key={r.id} className="sm:grid sm:grid-cols-[auto_1fr_1fr_1fr_1fr] sm:gap-2 sm:items-center px-4 py-2.5">
                    <div className="w-28">
                      <p className="text-xs font-medium text-forest-950">{fmtDate(r.date)}</p>
                      {late > 0 && <p className="text-xs text-amber-600">{late}m late</p>}
                      {!r.signIn && <p className="text-xs text-red-500">Absent</p>}
                      {reasonLabel && (
                        <p className="text-xs text-amber-700 mt-1">
                          {reasonLabel}{reasonNotes ? ` - ${reasonNotes}` : ''}
                        </p>
                      )}
                    </div>
                    {r.signIn ? (
                      <button
                        className="text-xs font-mono text-green-700 font-semibold cursor-pointer hover:bg-green-50 px-1 rounded transition-colors mt-2 sm:mt-0 block"
                        onClick={() => startEditTime(r.id, 'signIn', r.signIn, r.date)}
                      >
                        {fmtTime(r.signIn)}
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-stone-300 mt-2 sm:mt-0 block">{fmtTime(r.signIn)}</span>
                    )}
                    {r.signOut ? (
                      <button
                        className="text-xs font-mono text-blue-700 font-semibold cursor-pointer hover:bg-blue-50 px-1 rounded transition-colors mt-1 sm:mt-0 block"
                        onClick={() => startEditTime(r.id, 'signOut', r.signOut, r.date)}
                      >
                        {fmtTime(r.signOut)}
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-stone-300 mt-1 sm:mt-0 block">{fmtTime(r.signOut)}</span>
                    )}
                    <span className="text-xs text-stone-500 mt-1 sm:mt-0 block">{duration(r.signIn, r.signOut) || '—'}</span>
                    {collection.hasReason ? (
                      <button
                        className="text-xs text-stone-600 hover:bg-stone-100 px-1 rounded transition-colors truncate mt-1 sm:mt-0 block text-left"
                        onClick={() => openCollectionDetail({ fullName: collection.fullName, reason: collection.reason, participantName: participantDisplayName(participant), date: r.date })}
                        title="View collector reason"
                      >
                        {collection.summary} (view)
                      </button>
                    ) : (
                      <span className="text-xs text-stone-600 truncate mt-1 sm:mt-0 block">{collection.summary}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
      {participants.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-stone-400 text-sm">No participants registered yet.</p>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
const TABS = ['Daily', 'Weekly', 'Participant']

export default function AttendanceOverview({ participants, attendance, setAttendance }) {
  const [tab, setTab] = useState('Daily')
  const [editingTime, setEditingTime] = useState(null) // { recordId, type: 'signIn' | 'signOut', currentTime, date }
  const [timeInput, setTimeInput] = useState('')
  const [collectionDetail, setCollectionDetail] = useState(null)

  function startEditTime(recordId, type, currentTime, date) {
    const record = attendance.find(r => r.id === recordId)
    if (!record) return

    const timeString = `${new Date(currentTime).getHours().toString().padStart(2, '0')}:${new Date(currentTime).getMinutes().toString().padStart(2, '0')}`
    setEditingTime({ recordId, type, currentTime, date })
    setTimeInput(timeString)
  }

  function saveTime() {
    if (!editingTime) return

    const [hours, minutes] = timeInput.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      alert('Please enter a valid time in HH:MM format')
      return
    }

    const record = attendance.find(r => r.id === editingTime.recordId)
    if (!record) return

    const dateTime = new Date(`${editingTime.date}T${timeInput}:00`)
    const updatedRecord = {
      ...record,
      [editingTime.type]: dateTime.toISOString()
    }

    setAttendance(prev => prev.map(r => r.id === record.id ? updatedRecord : r))
    setEditingTime(null)
    setTimeInput('')
  }

  function cancelEditTime() {
    setEditingTime(null)
    setTimeInput('')
  }

  function openCollectionDetail(detail) {
    setCollectionDetail(detail)
  }

  function markPresent(participantId, date) {
    const existing = attendance.find(a => a.participantId === participantId && a.date === date)
    const signInIso = new Date(`${date}T10:00:00`).toISOString()

    if (existing) {
      setAttendance(prev => prev.map(r => r.id === existing.id ? { ...r, signIn: signInIso } : r))
      return
    }

    setAttendance(prev => [
      ...prev,
      {
        id: `${participantId}-${date}`,
        participantId,
        date,
        signIn: signInIso,
        signOut: null,
        collectedBy: null,
      },
    ])
  }

  function markAbsent(participantId, date) {
    const existing = attendance.find(a => a.participantId === participantId && a.date === date)
    if (!existing) return

    setAttendance(prev => prev.map(r => (
      r.id === existing.id
        ? { ...r, signIn: null, signOut: null, collectedBy: null }
        : r
    )))
  }

  return (
    <div className="fade-in space-y-5">
      {editingTime && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-in">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">
                  Edit {editingTime.type === 'signIn' ? 'Sign In' : 'Sign Out'} Time
                </h3>
                <ParticipantNameText
                  participant={participants.find(p => p.id === attendance.find(r => r.id === editingTime.recordId)?.participantId)}
                  className="text-sm text-stone-500 mt-0.5"
                />
              </div>
              <button onClick={cancelEditTime} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Time (HH:MM)</label>
                <input
                  type="text"
                  value={timeInput}
                  onChange={e => setTimeInput(e.target.value)}
                  className="input w-full"
                  placeholder="HH:MM"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-5 pt-0 flex gap-2">
              <button onClick={saveTime} className="btn-primary flex-1">Save Time</button>
              <button onClick={cancelEditTime} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {collectionDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md fade-in">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">Collection Details</h3>
                <p className="text-sm text-stone-500 mt-0.5">{collectionDetail.participantName} · {fmtDate(collectionDetail.date)}</p>
              </div>
              <button onClick={() => setCollectionDetail(null)} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Collector name</p>
                <p className="text-sm text-stone-800 mt-1">{collectionDetail.fullName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Reason for change</p>
                <p className="text-sm text-stone-800 mt-1 whitespace-pre-wrap">{collectionDetail.reason}</p>
              </div>
            </div>
            <div className="p-5 pt-0">
              <button onClick={() => setCollectionDetail(null)} className="btn-primary w-full">Close</button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-display font-bold text-forest-950">Attendance Overview</h2>
        <p className="text-stone-500 text-sm">{attendance.length} records total</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-display font-medium transition-all w-full sm:w-auto ${
              tab === t ? 'bg-forest-900 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
            }`}>{t}</button>
        ))}
      </div>

      <div className="fade-in" key={tab}>
        {tab === 'Daily' && <DailyOverview participants={participants} attendance={attendance} startEditTime={startEditTime} openCollectionDetail={openCollectionDetail} />}
        {tab === 'Weekly' && <WeeklyOverview participants={participants} attendance={attendance} startEditTime={startEditTime} markPresent={markPresent} markAbsent={markAbsent} />}
        {tab === 'Participant' && <ParticipantOverview participants={participants} attendance={attendance} startEditTime={startEditTime} openCollectionDetail={openCollectionDetail} />}
      </div>
    </div>
  )
}
