import { useMemo, useState } from 'react'
import { Printer, Search, Star, Trophy } from 'lucide-react'
import ParticipantNameText, { participantDisplayName } from './ParticipantNameText'
import { buildStarRangeDates, getStarTotalTone, isParticipantInSeason } from '../utils/starOfDay'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function formatColumnDate(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatRangeLabel(dateKeys) {
  if (!dateKeys.length) return 'No dates'
  const first = new Date(`${dateKeys[0]}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const last = new Date(`${dateKeys[dateKeys.length - 1]}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${first} - ${last}`
}

function totalBadgeClass(total) {
  const tone = getStarTotalTone(total)
  if (tone === 'high') return 'bg-red-100 text-red-700 border-red-200'
  if (tone === 'positive') return 'bg-green-100 text-green-700 border-green-200'
  return 'bg-stone-100 text-stone-600 border-stone-200'
}

const RANGE_OPTIONS = [
  { id: 'week', label: 'This Week' },
  { id: '14d', label: '14 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
]

export default function StarOfTheDay({ participants, starAwards, setStarAwards }) {
  const [search, setSearch] = useState('')
  const [rangeKey, setRangeKey] = useState('week')
  const [savingKey, setSavingKey] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const today = todayKey()

  const inSeasonParticipants = useMemo(() => (
    [...participants]
      .filter(isParticipantInSeason)
      .sort((a, b) => a.name.localeCompare(b.name))
  ), [participants])

  const filteredParticipants = useMemo(() => (
    inSeasonParticipants.filter(participant =>
      participantDisplayName(participant).toLowerCase().includes(search.toLowerCase())
    )
  ), [inSeasonParticipants, search])

  const dateKeys = useMemo(() => buildStarRangeDates(rangeKey, today, starAwards), [rangeKey, today, starAwards])
  const dateSet = useMemo(() => new Set(dateKeys), [dateKeys])

  const awardsInRange = useMemo(() => (
    starAwards.filter(award => dateSet.has(award.awardDate || award.award_date))
  ), [starAwards, dateSet])

  const awardLookup = useMemo(() => {
    const map = new Map()
    awardsInRange.forEach(award => {
      const key = `${award.participantId || award.participant_id}|${award.awardDate || award.award_date}`
      map.set(key, award)
    })
    return map
  }, [awardsInRange])

  const totalsByParticipant = useMemo(() => {
    const totals = new Map()
    filteredParticipants.forEach(participant => totals.set(participant.id, 0))
    awardsInRange.forEach(award => {
      const participantId = award.participantId || award.participant_id
      if (!totals.has(participantId)) return
      totals.set(participantId, (totals.get(participantId) || 0) + 1)
    })
    return totals
  }, [filteredParticipants, awardsInRange])

  const leaderboard = useMemo(() => (
    filteredParticipants
      .map(participant => ({
        participant,
        total: totalsByParticipant.get(participant.id) || 0,
      }))
      .filter(row => row.total > 0)
      .sort((a, b) => b.total - a.total || a.participant.name.localeCompare(b.participant.name))
      .slice(0, 3)
  ), [filteredParticipants, totalsByParticipant])

  async function toggleStar(participantId, awardDate) {
    const key = `${participantId}|${awardDate}`
    const existingAward = awardLookup.get(key)
    const nextAwards = existingAward
      ? starAwards.filter(award => award.id !== existingAward.id)
      : [
          ...starAwards,
          {
            id: crypto.randomUUID(),
            participantId,
            awardDate,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]

    setSavingKey(key)
    setMessage('')
    setError('')

    try {
      await setStarAwards(nextAwards)
      setMessage(existingAward ? 'Star removed.' : 'Star awarded.')
    } catch (saveError) {
      setError(saveError.message || 'Unable to save Star of the Day change')
    } finally {
      setSavingKey('')
    }
  }

  function printReport() {
    const rows = filteredParticipants.map(participant => {
      const cells = dateKeys.map(dateKey => {
        const hasStar = awardLookup.has(`${participant.id}|${dateKey}`)
        return `<td>${hasStar ? '★' : ''}</td>`
      }).join('')
      const total = totalsByParticipant.get(participant.id) || 0
      return `<tr><td>${participantDisplayName(participant)}</td>${cells}<td>${total}</td></tr>`
    }).join('')

    const headerCells = dateKeys.map(dateKey => `<th>${formatColumnDate(dateKey)}</th>`).join('')
    const popup = window.open('', '_blank', 'width=1200,height=800')
    if (!popup) {
      alert('Allow pop-ups to print the Star of the Day report.')
      return
    }

    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Star of the Day Report</title>
          <style>
            body { font-family: 'DM Sans', Arial, sans-serif; margin: 24px; color: #1f2937; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0 0 12px; color: #6b7280; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: center; }
            th:first-child, td:first-child { text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Star of the Day</h1>
          <p>${formatRangeLabel(dateKeys)} · In season only · Generated ${new Date().toLocaleString('en-GB')}</p>
          <table>
            <thead>
              <tr>
                <th>Child</th>
                ${headerCells}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="100%">No children found for this range.</td></tr>'}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `)
    popup.document.close()
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Star of the Day</h2>
          <p className="text-stone-500 text-sm">Recognition matrix for children currently included this season.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            In Season Only
          </span>
          <button onClick={printReport} className="btn-secondary text-xs flex items-center gap-1.5">
            <Printer size={13} /> Print / PDF Report
          </button>
        </div>
      </div>

      {leaderboard.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Trophy size={16} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-forest-950">Weekly Leaderboard</h3>
              <p className="text-xs text-stone-500">Top recognition totals for the current date range.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {leaderboard.map((row, index) => (
              <div key={row.participant.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">#{index + 1}</p>
                <ParticipantNameText participant={row.participant} className="font-display font-semibold text-forest-950 mt-1" />
                <p className="text-sm text-stone-500 mt-1">{row.total} star{row.total === 1 ? '' : 's'} this range</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by child name..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="input pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map(option => (
              <button
                key={option.id}
                onClick={() => setRangeKey(option.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${rangeKey === option.id ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-stone-500">Showing {filteredParticipants.length} child{filteredParticipants.length === 1 ? '' : 'ren'} · {formatRangeLabel(dateKeys)}</p>
          {(message || error) && (
            <p className={`text-xs font-medium ${error ? 'text-red-700' : 'text-emerald-700'}`}>
              {error || message}
            </p>
          )}
        </div>

        {filteredParticipants.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
            No in-season children match the current search.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-100">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 bg-stone-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500 border-b border-stone-100">
                    Child
                  </th>
                  {dateKeys.map(dateKey => (
                    <th key={dateKey} className="sticky top-0 z-10 bg-stone-50 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-stone-500 border-b border-stone-100 min-w-[72px]">
                      {formatColumnDate(dateKey)}
                    </th>
                  ))}
                  <th className="sticky right-0 top-0 z-20 bg-stone-50 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-stone-500 border-b border-stone-100 min-w-[92px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map(participant => {
                  const total = totalsByParticipant.get(participant.id) || 0
                  return (
                    <tr key={participant.id} className="hover:bg-stone-50/70">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 border-b border-stone-100 whitespace-nowrap">
                        <ParticipantNameText participant={participant} className="font-medium text-forest-950" />
                      </td>
                      {dateKeys.map(dateKey => {
                        const key = `${participant.id}|${dateKey}`
                        const awarded = awardLookup.has(key)
                        const isSaving = savingKey === key
                        return (
                          <td key={dateKey} className="border-b border-stone-100 px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleStar(participant.id, dateKey)}
                              disabled={isSaving}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${awarded ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-stone-200 bg-white text-stone-300 hover:border-amber-200 hover:text-amber-500'} ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                              aria-label={`${awarded ? 'Remove' : 'Award'} star for ${participantDisplayName(participant)} on ${dateKey}`}
                              title={`${awarded ? 'Remove' : 'Award'} star`}
                            >
                              <Star size={16} className={awarded ? 'fill-current' : ''} />
                            </button>
                          </td>
                        )
                      })}
                      <td className="sticky right-0 z-10 bg-white px-4 py-3 border-b border-stone-100 text-center">
                        <span className={`inline-flex min-w-[56px] items-center justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${totalBadgeClass(total)}`}>
                          {total}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
