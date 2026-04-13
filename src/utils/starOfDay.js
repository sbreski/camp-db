export function isParticipantInSeason(participant) {
  const seasonFlag = participant?.isActiveThisSeason ?? participant?.is_active_this_season
  if (typeof seasonFlag === 'string') return seasonFlag.toLowerCase() !== 'false'
  return seasonFlag !== false
}

export function getStarTotalTone(total) {
  if (total >= 2) return 'high'
  if (total >= 1) return 'positive'
  return 'neutral'
}

export function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekStart(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().slice(0, 10)
}

export function monthStart(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(1)
  return date.toISOString().slice(0, 10)
}

export function listDateKeys(startKey, endKey) {
  const keys = []
  let current = startKey
  while (current <= endKey) {
    keys.push(current)
    current = addDays(current, 1)
  }
  return keys
}

export function buildStarRangeDates(rangeKey, todayKey, starAwards = []) {
  const safeToday = todayKey || new Date().toISOString().slice(0, 10)
  let startKey = safeToday

  switch (rangeKey) {
    case 'week':
      startKey = weekStart(safeToday)
      break
    case '14d':
      startKey = addDays(safeToday, -13)
      break
    case '30d':
      startKey = addDays(safeToday, -29)
      break
    case 'month':
      startKey = monthStart(safeToday)
      break
    case 'all': {
      const earliestAward = [...(starAwards || [])]
        .map(award => award?.awardDate || award?.award_date || '')
        .filter(Boolean)
        .sort()[0]
      startKey = earliestAward || weekStart(safeToday)
      break
    }
    default:
      startKey = weekStart(safeToday)
      break
  }

  return listDateKeys(startKey, safeToday)
}
