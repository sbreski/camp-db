import { useMemo, useState } from 'react'
import { Printer, Search, Star } from 'lucide-react'
import ParticipantNameText, { participantDisplayName } from './ParticipantNameText'
import { addDays, buildDatesFromRanges, buildStarRangeDates, getStarTotalTone, isParticipantInSeason } from '../utils/starOfDay'

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

function formatShortDate(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function defaultCustomRanges(today) {
  const startKey = buildStarRangeDates('week', today)[0] || today
  return [{ id: `${startKey}-${today}`, startKey, endKey: today }]
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
  { id: 'custom', label: 'Camp Period' },
]

export default function StarOfTheDay({ participants, starAwards, setStarAwards, campPeriod }) {
  const [search, setSearch] = useState('')
  const [rangeKey, setRangeKey] = useState('week')
  const [customRanges, setCustomRanges] = useState(() => defaultCustomRanges(todayKey()))
  const [rangeStartInput, setRangeStartInput] = useState(() => defaultCustomRanges(todayKey())[0].startKey)
  const [rangeEndInput, setRangeEndInput] = useState(() => defaultCustomRanges(todayKey())[0].endKey)
  const [savingKey, setSavingKey] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const today = todayKey()
  const campStart = String(campPeriod?.startDate || campPeriod?.start_date || '').trim()
  const campEnd = String(campPeriod?.endDate || campPeriod?.end_date || '').trim()
  const hasCampPeriod = Boolean(campStart && campEnd)

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

  const dateKeys = useMemo(() => {
    if (rangeKey === 'custom') {
      if (hasCampPeriod) {
        return buildDatesFromRanges([{ id: 'camp-period', startKey: campStart, endKey: campEnd }])
      }
      return buildDatesFromRanges(customRanges)
    }
    return buildStarRangeDates(rangeKey, today, starAwards)
  }, [rangeKey, today, starAwards, customRanges, hasCampPeriod, campStart, campEnd])
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

  const visiblePeriodLabel = useMemo(() => {
    if (rangeKey !== 'custom') return formatRangeLabel(dateKeys)
    if (hasCampPeriod) {
      return `Camp Period: ${formatRangeLabel(buildDatesFromRanges([{ id: 'camp-period', startKey: campStart, endKey: campEnd }]))}`
    }
    if (customRanges.length === 0) return 'No dates'
    return customRanges
      .map(range => range.startKey === range.endKey
        ? formatShortDate(range.startKey)
        : `${formatShortDate(range.startKey)} - ${formatShortDate(range.endKey)}`)
      .join(', ')
  }, [rangeKey, dateKeys, customRanges, hasCampPeriod, campStart, campEnd])

  function selectRange(optionId) {
    setRangeKey(optionId)
    setMessage('')
    setError('')
  }

  function addCustomRange() {
    if (!rangeStartInput || !rangeEndInput) {
      setError('Choose both a start and end date first.')
      return
    }

    const startKey = rangeStartInput <= rangeEndInput ? rangeStartInput : rangeEndInput
    const endKey = rangeStartInput <= rangeEndInput ? rangeEndInput : rangeStartInput
    const nextRange = { id: `${startKey}-${endKey}-${crypto.randomUUID()}`, startKey, endKey }
    setCustomRanges(prev => [...prev, nextRange])
    setRangeKey('custom')
    setError('')
    setMessage('Visible period updated.')
    const nextStart = addDays(endKey, 1)
    setRangeStartInput(nextStart)
    setRangeEndInput(nextStart)
  }

  function removeCustomRange(rangeId) {
    setCustomRanges(prev => prev.filter(range => range.id !== rangeId))
  }

  function resetCustomRanges() {
    const initialRanges = defaultCustomRanges(today)
    setCustomRanges(initialRanges)
    setRangeStartInput(initialRanges[0].startKey)
    setRangeEndInput(initialRanges[0].endKey)
    setRangeKey('custom')
  }

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
          <p>${visiblePeriodLabel} · In season only · Generated ${new Date().toLocaleString('en-GB')}</p>
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
                onClick={() => selectRange(option.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-display font-medium border ${rangeKey === option.id ? 'bg-forest-900 text-white border-forest-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {rangeKey === 'custom' && hasCampPeriod && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-1">
            <p className="text-xs font-semibold text-emerald-900">Camp Period (shared)</p>
            <p className="text-sm text-emerald-800">
              {formatShortDate(campStart)} - {formatShortDate(campEnd)}
            </p>
          </div>
        )}

        {rangeKey === 'custom' && !hasCampPeriod && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
              <div>
                <label className="label">Range Start</label>
                <input
                  type="date"
                  className="input"
                  value={rangeStartInput}
                  onChange={event => setRangeStartInput(event.target.value)}
                />
              </div>
              <div>
                <label className="label">Range End</label>
                <input
                  type="date"
                  className="input"
                  value={rangeEndInput}
                  onChange={event => setRangeEndInput(event.target.value)}
                />
              </div>
              <button type="button" onClick={addCustomRange} className="btn-primary text-xs py-2.5">
                Add Range
              </button>
              <button type="button" onClick={resetCustomRanges} className="btn-secondary text-xs py-2.5">
                Reset
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {customRanges.length === 0 ? (
                <p className="text-xs text-stone-500">No custom ranges selected yet.</p>
              ) : customRanges.map(range => (
                <span key={range.id} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700">
                  {range.startKey === range.endKey
                    ? formatShortDate(range.startKey)
                    : `${formatShortDate(range.startKey)} - ${formatShortDate(range.endKey)}`}
                  <button
                    type="button"
                    onClick={() => removeCustomRange(range.id)}
                    className="text-stone-400 hover:text-red-600"
                    aria-label="Remove custom date range"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-stone-500">Showing {filteredParticipants.length} child{filteredParticipants.length === 1 ? '' : 'ren'} · {visiblePeriodLabel}</p>
          {(message || error) && (
            <p className={`text-xs font-medium ${error ? 'text-red-700' : 'text-emerald-700'}`}>
              {error || message}
            </p>
          )}
        </div>

        {dateKeys.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
            Add at least one visible date range to build the matrix.
          </div>
        ) : filteredParticipants.length === 0 ? (
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
