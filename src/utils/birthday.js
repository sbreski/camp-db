export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function birthdayParts(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  if (Number.isNaN(month) || Number.isNaN(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { month, day }
}

function makeBirthdayDate(year, month, day) {
  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0)
  if (candidate.getMonth() === month - 1 && candidate.getDate() === day) return candidate
  if (month === 2 && day === 29) return new Date(year, 1, 28, 12, 0, 0, 0)
  return null
}

export function daysUntilBirthday(birthday, fromDateKey) {
  const parts = birthdayParts(birthday)
  if (!parts) return null

  const from = new Date(`${fromDateKey}T12:00:00`)
  if (Number.isNaN(from.getTime())) return null

  let next = makeBirthdayDate(from.getFullYear(), parts.month, parts.day)
  if (!next) return null
  if (next < from) {
    next = makeBirthdayDate(from.getFullYear() + 1, parts.month, parts.day)
    if (!next) return null
  }

  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((next.getTime() - from.getTime()) / msPerDay)
}

export function formatBirthDate(value) {
  const iso = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!iso) return ''
  const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
