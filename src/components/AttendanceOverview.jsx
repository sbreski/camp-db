import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock, TrendingUp, AlertCircle, User } from 'lucide-react'

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

function lateMinutes(signIn, threshold = '10:00') {
  if (!signIn) return null
  const t = new Date(signIn)
  const [h, m] = threshold.split(':').map(Number)
  const cutoff = new Date(t)
  cutoff.setHours(h, m, 0, 0)
  const diff = Math.round((t - cutoff) / 60000)
  return diff > 0 ? diff : 0
}

// ─── Daily Overview ───────────────────────────────────────────────────────────
function DailyOverview({ participants, attendance }) {
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
      <div className="grid grid-cols-3 gap-3">
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
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-500 uppercase tracking-wide">
          <span>Participant</span>
          <span className="w-20 text-right">Sign In</span>
          <span className="w-20 text-right">Sign Out</span>
          <span className="w-20 text-right">Duration</span>
          <span className="w-28 text-right">Collected by</span>
        </div>
        <div className="divide-y divide-stone-50">
          {rows.map(({ p, rec }) => {
            const late = lateMinutes(rec?.signIn)
            return (
              <div key={p.id} className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center px-4 py-2.5 ${!rec?.signIn ? 'opacity-50 bg-red-50/30' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-forest-950">{p.name}</p>
                  {late > 0 && (
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      <AlertCircle size={10} /> {late} min late
                    </p>
                  )}
                  {!rec?.signIn && <p className="text-xs text-red-500">Absent</p>}
                </div>
                <span className={`w-20 text-right text-xs font-mono ${rec?.signIn ? 'text-green-700 font-semibold' : 'text-stone-300'}`}>{fmtTime(rec?.signIn)}</span>
                <span className={`w-20 text-right text-xs font-mono ${rec?.signOut ? 'text-blue-700 font-semibold' : 'text-stone-300'}`}>{fmtTime(rec?.signOut)}</span>
                <span className="w-20 text-right text-xs text-stone-500">{duration(rec?.signIn, rec?.signOut) || (rec?.signIn ? <span className="text-amber-600">On site</span> : '—')}</span>
                <span className="w-28 text-right text-xs text-stone-600 truncate">{rec?.collectedBy || '—'}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Weekly Overview ──────────────────────────────────────────────────────────
function WeeklyOverview({ participants, attendance }) {
  const [weekOf, setWeekOf] = useState(weekStart(todayKey()))
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekOf, i)) // Mon–Fri

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
      <div className="grid grid-cols-5 gap-2">
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
                  <td className="px-4 py-2 font-medium text-forest-950 whitespace-nowrap">{p.name}</td>
                  {days.map(day => {
                    const rec = attendance.find(a => a.participantId === p.id && a.date === day)
                    const late = lateMinutes(rec?.signIn)
                    if (rec?.signIn) totalDays++
                    if (late > 0) totalLate++
                    return (
                      <td key={day} className={`px-2 py-2 text-center ${day === todayKey() ? 'bg-amber-50' : ''}`}>
                        {rec?.signIn ? (
                          <div>
                            <span className={`inline-block w-6 h-6 rounded-full text-xs font-bold leading-6 ${late > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                              {late > 0 ? 'L' : '✓'}
                            </span>
                            <div className="text-stone-400 mt-0.5 font-mono">{fmtTime(rec.signIn)}</div>
                          </div>
                        ) : (
                          <span className="inline-block w-6 h-6 rounded-full bg-red-50 text-red-400 text-xs font-bold leading-6">✗</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-center font-semibold text-forest-900">{totalDays}/5</td>
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
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">L</span> Late (&gt;10:00)</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-red-50 text-red-400 flex items-center justify-center font-bold text-xs">✗</span> Absent</span>
      </div>
    </div>
  )
}

// ─── Participant Overview ─────────────────────────────────────────────────────
function ParticipantOverview({ participants, attendance }) {
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
            <option key={p.id} value={p.id}>{p.name}</option>
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
                      <span className={`text-xs font-mono font-semibold w-12 flex-shrink-0 ${late > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {fmtTime(r.signIn)}
                      </span>
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
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-500 uppercase tracking-wide">
              <span className="w-28">Date</span>
              <span>In</span><span>Out</span><span>Duration</span><span>Collected by</span>
            </div>
            <div className="divide-y divide-stone-50">
              {records.length === 0 ? (
                <p className="text-center text-stone-400 text-sm py-6">No attendance recorded.</p>
              ) : records.map(r => {
                const late = lateMinutes(r.signIn)
                return (
                  <div key={r.id} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-2 items-center px-4 py-2.5">
                    <div className="w-28">
                      <p className="text-xs font-medium text-forest-950">{fmtDate(r.date)}</p>
                      {late > 0 && <p className="text-xs text-amber-600">{late}m late</p>}
                      {!r.signIn && <p className="text-xs text-red-500">Absent</p>}
                    </div>
                    <span className={`text-xs font-mono ${r.signIn ? 'text-green-700 font-semibold' : 'text-stone-300'}`}>{fmtTime(r.signIn)}</span>
                    <span className={`text-xs font-mono ${r.signOut ? 'text-blue-700 font-semibold' : 'text-stone-300'}`}>{fmtTime(r.signOut)}</span>
                    <span className="text-xs text-stone-500">{duration(r.signIn, r.signOut) || '—'}</span>
                    <span className="text-xs text-stone-600 truncate">{r.collectedBy || '—'}</span>
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

export default function AttendanceOverview({ participants, attendance }) {
  const [tab, setTab] = useState('Daily')

  return (
    <div className="fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-display font-bold text-forest-950">Attendance Overview</h2>
        <p className="text-stone-500 text-sm">{attendance.length} records total</p>
      </div>

      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-display font-medium transition-all ${
              tab === t ? 'bg-forest-900 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
            }`}>{t}</button>
        ))}
      </div>

      <div className="fade-in" key={tab}>
        {tab === 'Daily' && <DailyOverview participants={participants} attendance={attendance} />}
        {tab === 'Weekly' && <WeeklyOverview participants={participants} attendance={attendance} />}
        {tab === 'Participant' && <ParticipantOverview participants={participants} attendance={attendance} />}
      </div>
    </div>
  )
}
