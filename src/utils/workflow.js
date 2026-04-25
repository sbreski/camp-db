export function getIncidentDueDateKey(incident) {
  if (!incident) return null
  if (incident.followUpDueDate) return incident.followUpDueDate
  if (!incident.createdAt) return null
  return String(incident.createdAt).slice(0, 10)
}

export function getFollowUpStatus(incident, dateKey) {
  if (!incident?.followUpRequired || incident?.followUpCompletedAt) return null
  const dueDateKey = getIncidentDueDateKey(incident)
  if (!dueDateKey || !dateKey) return null
  if (dueDateKey < dateKey) return 'overdue'
  if (dueDateKey === dateKey) return 'due'
  return null
}

export function getPendingFollowUpsForParticipant(incidents, participantId, dateKey) {
  return (incidents || [])
    .filter((incident) => {
      if (incident.participantId !== participantId) return false
      if (incident.followUpTiming === 'today') return false
      return getFollowUpStatus(incident, dateKey) !== null
    })
    .sort((a, b) => {
      const aDue = getIncidentDueDateKey(a) || ''
      const bDue = getIncidentDueDateKey(b) || ''
      if (aDue !== bDue) return aDue.localeCompare(bDue)
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    })
}

export function getFollowUpsDue(incidents, participants, dateKey) {
  return (incidents || [])
    .map((incident) => {
      if (incident.followUpTiming === 'today') return null
      const status = getFollowUpStatus(incident, dateKey)
      if (!status) return null
      return {
        ...incident,
        status,
        dueDate: getIncidentDueDateKey(incident),
        participant: (participants || []).find((p) => p.id === incident.participantId) || null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'overdue' ? -1 : 1
      return (a.dueDate || '').localeCompare(b.dueDate || '')
    })
}

export function toCsv(rows) {
  if (!rows || rows.length === 0) return ''

  const headers = []
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (!headers.includes(key)) headers.push(key)
    })
  })

  const escape = (value) => {
    if (value === null || value === undefined) return ''
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const lines = [headers.join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((header) => escape(row[header])).join(','))
  })
  return lines.join('\n')
}
