import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Printer, Trash2, X } from 'lucide-react'

const DEFAULT_SPACE_OPTIONS = ['Drama Space', 'Art Space', 'bardepot', 'Studio Theatre']
const DAY_START_MINUTES = 9 * 60 + 45
const DAY_END_MINUTES = 16 * 60 + 30
const GRID_STEP_MINUTES = 15
const USUAL_BLOCKS = [
  ['09:45', '10:00'],
  ['10:00', '10:30'],
  ['10:30', '11:15'],
  ['11:15', '11:30'],
  ['11:30', '12:45'],
  ['12:45', '13:30'],
  ['13:30', '14:45'],
  ['14:45', '15:00'],
  ['15:00', '15:30'],
  ['15:30', '16:00'],
  ['16:00', '16:15'],
  ['16:15', '16:30'],
]
const SPACE_COLOR_STORAGE_KEY = 'timetable-space-color-map-v1'
const DEFAULT_SPACE_COLORS = {
  'drama space': '#fef3c7',
  'art space': '#ede9fe',
  bardepot: '#d1fae5',
  'studio theatre': '#fee2e2',
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDateLabel(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function dayShort(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function timeToMinutes(timeValue) {
  if (!timeValue || !String(timeValue).includes(':')) return null
  const [h, m] = String(timeValue).split(':')
  const hh = Number(h)
  const mm = Number(m)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

function minutesToTimeLabel(totalMinutes) {
  const hh = Math.floor(totalMinutes / 60)
  const mm = totalMinutes % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function buildTimeRows(startMinutes, endMinutes, stepMinutes) {
  const rows = []
  for (let t = startMinutes; t < endMinutes; t += stepMinutes) {
    rows.push({
      startMinutes: t,
      endMinutes: Math.min(t + stepMinutes, endMinutes),
      startLabel: minutesToTimeLabel(t),
      endLabel: minutesToTimeLabel(Math.min(t + stepMinutes, endMinutes)),
    })
  }
  return rows
}

function buildRowsFromUsualBlocks() {
  return USUAL_BLOCKS
    .map(([start, end]) => {
      const startMinutes = timeToMinutes(start)
      const endMinutes = timeToMinutes(end)
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null
      return {
        startMinutes,
        endMinutes,
        startLabel: start,
        endLabel: end,
      }
    })
    .filter(Boolean)
}

function normalizeHexColor(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : ''
}

function colorMapFromStorage() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(SPACE_COLOR_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}

    const next = {}
    for (const [key, value] of Object.entries(parsed)) {
      const color = normalizeHexColor(value)
      if (color) next[key] = color
    }
    return next
  } catch {
    return {}
  }
}

function saveColorMapToStorage(map) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SPACE_COLOR_STORAGE_KEY, JSON.stringify(map || {}))
}

function buildDateRange(startDate, endDate) {
  const list = []
  if (!startDate || !endDate || startDate > endDate) return list
  let cursor = startDate
  while (cursor <= endDate) {
    list.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return list
}

function normalizeAssignedEmails(entry) {
  const fromArray = Array.isArray(entry.assignedEmails)
    ? entry.assignedEmails
    : Array.isArray(entry.assigned_emails)
      ? entry.assigned_emails
      : []
  const merged = [...fromArray, entry.assignedEmail || entry.assigned_email]
  return [...new Set(merged.map(normalizeText).filter(Boolean))]
}

function entrySpaceName(entry) {
  return String(entry.spaceName || entry.space_name || entry.location || '').trim()
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB
}

function isActiveInRange(entry, slotStart, slotEnd) {
  const start = timeToMinutes(entry.startTime || entry.start_time)
  const end = timeToMinutes(entry.endTime || entry.end_time)
  if (start === null || end === null) return false
  return overlaps(start, end, slotStart, slotEnd)
}

function getSpaceSortOrder(space) {
  const fromRow = Number(space.sortOrder ?? space.sort_order)
  if (Number.isFinite(fromRow)) return fromRow
  return 1000
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function emptyEntry(selectedDate, actorInitials) {
  return {
    id: null,
    dayDate: selectedDate,
    startTime: '09:45',
    endTime: '10:00',
    activityName: '',
    groupName: '',
    spaceName: DEFAULT_SPACE_OPTIONS[0],
    customSpaceName: '',
    notes: '',
    assignedEmails: [],
    createdByInitials: actorInitials,
    applyToRange: false,
    rangeStartDate: selectedDate,
    rangeEndDate: selectedDate,
    weekdays: {
      Mon: true,
      Tue: true,
      Wed: true,
      Thu: true,
      Fri: true,
      Sat: true,
      Sun: true,
    },
  }
}

export default function Timetable({
  timetableEntries = [],
  setTimetableEntries,
  timetableSpaces = [],
  setTimetableSpaces,
  actorInitials = 'ST',
  staffList = [],
  currentUserEmail = '',
  currentUserName = '',
  isOwnerUser = false,
  isAdminUser = false,
  canViewTimetableOverview = false,
  canEditTimetable = false,
}) {
  const canEdit = Boolean(isOwnerUser || isAdminUser || canEditTimetable)
  const canSeeOverview = Boolean(canEdit || canViewTimetableOverview)

  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [viewMode, setViewMode] = useState('staff')
  const [staffFilter, setStaffFilter] = useState('all')
  const [spaceFilter, setSpaceFilter] = useState('all')
  const [editingEntry, setEditingEntry] = useState(null)
  const [saving, setSaving] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [duplicateTargetDate, setDuplicateTargetDate] = useState(addDays(todayKey(), 1))
  const [spaceColors, setSpaceColors] = useState(() => {
    const fromStorage = colorMapFromStorage()
    return { ...DEFAULT_SPACE_COLORS, ...fromStorage }
  })

  useEffect(() => {
    if (!canSeeOverview && viewMode !== 'staff') {
      setViewMode('staff')
    }
  }, [canSeeOverview, viewMode])

  const timeRows = useMemo(() => buildRowsFromUsualBlocks(), [])

  function colorForSpace(spaceName) {
    const key = normalizeText(spaceName)
    return normalizeHexColor(spaceColors[key]) || '#ecfdf5'
  }

  function updateSpaceColor(spaceName, nextColor) {
    const key = normalizeText(spaceName)
    if (!key) return
    const color = normalizeHexColor(nextColor)
    if (!color) return

    setSpaceColors(prev => {
      const next = { ...prev, [key]: color }
      saveColorMapToStorage(next)
      return next
    })
  }

  const staffOptions = useMemo(() => {
    return [...staffList]
      .filter(staff => normalizeText(staff.email))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .map(staff => ({
        email: normalizeText(staff.email),
        label: staff.name || staff.email,
      }))
  }, [staffList])

  const staffFromEntries = useMemo(() => {
    const options = []
    const seen = new Set()
    for (const entry of timetableEntries) {
      for (const email of normalizeAssignedEmails(entry)) {
        if (seen.has(email)) continue
        seen.add(email)
        options.push({ email, label: email })
      }
    }
    return options
  }, [timetableEntries])

  const allStaffOptions = useMemo(() => {
    const merged = new Map()
    for (const option of [...staffOptions, ...staffFromEntries]) {
      if (!option.email) continue
      if (!merged.has(option.email)) merged.set(option.email, option)
    }
    return [...merged.values()]
  }, [staffOptions, staffFromEntries])

  const myStaffOption = useMemo(() => {
    const email = normalizeText(currentUserEmail)
    const found = allStaffOptions.find(option => option.email === email)
    if (found) return found
    return {
      email,
      label: currentUserName || currentUserEmail || 'My timetable',
    }
  }, [allStaffOptions, currentUserEmail, currentUserName])

  const persistedSpaceRecords = useMemo(() => {
    return [...timetableSpaces]
      .map(space => ({
        id: space.id,
        name: String(space.name || '').trim(),
        sortOrder: getSpaceSortOrder(space),
      }))
      .filter(space => Boolean(space.name))
      .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name))
  }, [timetableSpaces])

  const spaceOptions = useMemo(() => {
    const seen = new Set()
    const ordered = []

    if (persistedSpaceRecords.length > 0) {
      for (const record of persistedSpaceRecords) {
        const key = normalizeText(record.name)
        if (!key || seen.has(key)) continue
        seen.add(key)
        ordered.push(record.name)
      }
    } else {
      for (const defaultSpace of DEFAULT_SPACE_OPTIONS) {
        const key = normalizeText(defaultSpace)
        if (!key || seen.has(key)) continue
        seen.add(key)
        ordered.push(defaultSpace)
      }
    }

    for (const entry of timetableEntries) {
      const name = entrySpaceName(entry)
      const key = normalizeText(name)
      if (!name || seen.has(key)) continue
      seen.add(key)
      ordered.push(name)
    }

    return ordered
  }, [persistedSpaceRecords, timetableEntries])

  const visibleEntries = useMemo(() => {
    if (canSeeOverview) return timetableEntries

    const email = normalizeText(currentUserEmail)
    const name = normalizeText(currentUserName)

    return timetableEntries.filter(entry => {
      const assigned = normalizeAssignedEmails(entry)
      if (email && assigned.includes(email)) return true
      const lead = normalizeText(entry.leadStaff || entry.lead_staff)
      return Boolean(name && lead.includes(name))
    })
  }, [timetableEntries, canSeeOverview, currentUserEmail, currentUserName])

  const dayEntries = useMemo(() => {
    let rows = visibleEntries
      .filter(entry => (entry.dayDate || entry.day_date) === selectedDate)
      .sort((a, b) => {
        const aStart = String(a.startTime || a.start_time || '')
        const bStart = String(b.startTime || b.start_time || '')
        return aStart.localeCompare(bStart)
      })

    if (viewMode === 'staff' && canSeeOverview && staffFilter !== 'all') {
      rows = rows.filter(entry => normalizeAssignedEmails(entry).includes(normalizeText(staffFilter)))
    }

    if (viewMode === 'space' && canSeeOverview && spaceFilter !== 'all') {
      rows = rows.filter(entry => normalizeText(entrySpaceName(entry)) === normalizeText(spaceFilter))
    }

    return rows
  }, [visibleEntries, selectedDate, viewMode, canSeeOverview, staffFilter, spaceFilter])

  const columns = useMemo(() => {
    if (viewMode === 'space') {
      if (!canSeeOverview) return []
      if (spaceFilter !== 'all') return [spaceFilter]
      return spaceOptions
    }

    if (!canSeeOverview) return [myStaffOption]
    if (staffFilter !== 'all') {
      return allStaffOptions.filter(option => option.email === normalizeText(staffFilter))
    }
    return allStaffOptions
  }, [viewMode, canSeeOverview, spaceFilter, spaceOptions, myStaffOption, allStaffOptions, staffFilter])

  const conflictSummary = useMemo(() => {
    if (!canSeeOverview) return { slotAlerts: [], entryConflictIds: new Set() }

    const entryConflictIds = new Set()
    const slotAlerts = []

    for (let i = 0; i < dayEntries.length; i += 1) {
      const a = dayEntries[i]
      const aStart = timeToMinutes(a.startTime || a.start_time)
      const aEnd = timeToMinutes(a.endTime || a.end_time)
      if (aStart === null || aEnd === null) continue
      const aAssigned = normalizeAssignedEmails(a)

      for (let j = i + 1; j < dayEntries.length; j += 1) {
        const b = dayEntries[j]
        const bStart = timeToMinutes(b.startTime || b.start_time)
        const bEnd = timeToMinutes(b.endTime || b.end_time)
        if (bStart === null || bEnd === null) continue
        if (!overlaps(aStart, aEnd, bStart, bEnd)) continue

        const bAssigned = normalizeAssignedEmails(b)
        const shared = aAssigned.filter(email => bAssigned.includes(email))
        if (shared.length === 0) continue

        entryConflictIds.add(a.id)
        entryConflictIds.add(b.id)
      }
    }

    for (const row of timeRows) {
      const counts = new Map()
      for (const entry of dayEntries) {
        if (!isActiveInRange(entry, row.startMinutes, row.endMinutes)) continue
        for (const email of normalizeAssignedEmails(entry)) {
          counts.set(email, (counts.get(email) || 0) + 1)
        }
      }

      const doubleBookedEmails = [...counts.entries()].filter(([, count]) => count > 1).map(([email]) => email)
      if (doubleBookedEmails.length === 0) continue

      const labels = doubleBookedEmails.map(email => allStaffOptions.find(option => option.email === email)?.label || email)
      slotAlerts.push({ slot: `${row.startLabel} - ${row.endLabel}`, staff: labels })
    }

    return { slotAlerts, entryConflictIds }
  }, [canSeeOverview, dayEntries, timeRows, allStaffOptions])

  function openCreate() {
    if (!canEdit) return
    setEditingEntry(emptyEntry(selectedDate, actorInitials))
  }

  function openCreateAtSlot(column, slotStart, slotEnd) {
    if (!canEdit) return
    const base = emptyEntry(selectedDate, actorInitials)
    const seeded = {
      ...base,
      startTime: slotStart,
      endTime: slotEnd,
    }

    if (viewMode === 'staff' && column?.email) {
      seeded.assignedEmails = [column.email]
    }
    if (viewMode === 'space' && typeof column === 'string') {
      seeded.spaceName = column
    }

    setEditingEntry(seeded)
  }

  function openEdit(entry) {
    if (!canEdit) return
    const assignedEmails = normalizeAssignedEmails(entry)
    const space = entrySpaceName(entry)
    const hasKnownSpace = spaceOptions.some(option => normalizeText(option) === normalizeText(space))

    setEditingEntry({
      id: entry.id,
      dayDate: entry.dayDate || entry.day_date || selectedDate,
      startTime: entry.startTime || entry.start_time || '09:45',
      endTime: entry.endTime || entry.end_time || '10:00',
      activityName: entry.activityName || entry.activity_name || '',
      groupName: entry.groupName || entry.group_name || '',
      spaceName: hasKnownSpace ? space : 'Other',
      customSpaceName: hasKnownSpace ? '' : space,
      notes: entry.notes || '',
      assignedEmails,
      createdByInitials: entry.createdByInitials || entry.created_by_initials || actorInitials,
      applyToRange: false,
      rangeStartDate: entry.dayDate || entry.day_date || selectedDate,
      rangeEndDate: entry.dayDate || entry.day_date || selectedDate,
      weekdays: {
        Mon: true,
        Tue: true,
        Wed: true,
        Thu: true,
        Fri: true,
        Sat: true,
        Sun: true,
      },
    })
  }

  function closeEditor() {
    setEditingEntry(null)
  }

  function setField(key, value) {
    setEditingEntry(prev => ({ ...prev, [key]: value }))
  }

  function toggleAssigned(email) {
    setEditingEntry(prev => {
      const has = prev.assignedEmails.includes(email)
      const next = has
        ? prev.assignedEmails.filter(item => item !== email)
        : [...prev.assignedEmails, email]
      return { ...prev, assignedEmails: next }
    })
  }

  function toggleWeekday(day) {
    setEditingEntry(prev => ({
      ...prev,
      weekdays: {
        ...prev.weekdays,
        [day]: !prev.weekdays[day],
      },
    }))
  }

  function applyUsualBlock(start, end) {
    setEditingEntry(prev => ({ ...prev, startTime: start, endTime: end }))
  }

  function targetDatesFromEditor(entry) {
    if (!entry.applyToRange) return [entry.dayDate || selectedDate]

    const range = buildDateRange(entry.rangeStartDate, entry.rangeEndDate)
    return range.filter(date => {
      const day = dayShort(date)
      return Boolean(entry.weekdays[day])
    })
  }

  function validateConflicts(payload, targetDates) {
    const payloadStart = timeToMinutes(payload.startTime)
    const payloadEnd = timeToMinutes(payload.endTime)
    const assigned = payload.assignedEmails

    for (const date of targetDates) {
      for (const existing of timetableEntries) {
        if ((existing.dayDate || existing.day_date) !== date) continue
        if (payload.id && existing.id === payload.id) continue

        const existingStart = timeToMinutes(existing.startTime || existing.start_time)
        const existingEnd = timeToMinutes(existing.endTime || existing.end_time)
        if (existingStart === null || existingEnd === null) continue
        if (!overlaps(payloadStart, payloadEnd, existingStart, existingEnd)) continue

        const existingAssigned = normalizeAssignedEmails(existing)
        const conflicts = assigned.filter(email => existingAssigned.includes(email))
        if (conflicts.length === 0) continue

        const labels = conflicts.map(email => allStaffOptions.find(option => option.email === email)?.label || email)
        return `Conflict on ${date}: ${labels.join(', ')} already assigned at this time.`
      }
    }

    return ''
  }

  async function saveEntry(e) {
    e.preventDefault()
    if (!canEdit) {
      alert('Only owner/admin accounts can edit timetables.')
      return
    }
    if (!editingEntry?.activityName?.trim()) {
      alert('Please add an activity name.')
      return
    }

    const start = timeToMinutes(editingEntry.startTime)
    const end = timeToMinutes(editingEntry.endTime)

    if (start === null || end === null || start < DAY_START_MINUTES || end > DAY_END_MINUTES || end <= start) {
      alert('Times must stay between 09:45 and 16:30, and end must be after start.')
      return
    }

    if (!Array.isArray(editingEntry.assignedEmails) || editingEntry.assignedEmails.length === 0) {
      alert('Assign at least one staff member.')
      return
    }

    const resolvedSpaceName = editingEntry.spaceName === 'Other'
      ? String(editingEntry.customSpaceName || '').trim()
      : String(editingEntry.spaceName || '').trim()

    if (!resolvedSpaceName) {
      alert('Please choose a space, or provide a custom one for Other.')
      return
    }

    const targetDates = targetDatesFromEditor(editingEntry)
    if (targetDates.length === 0) {
      alert('No dates selected for this save operation.')
      return
    }

    const normalizedAssignedEmails = [...new Set(editingEntry.assignedEmails.map(normalizeText).filter(Boolean))]
    const basePayload = {
      id: editingEntry.id || null,
      dayDate: editingEntry.dayDate || selectedDate,
      startTime: editingEntry.startTime,
      endTime: editingEntry.endTime,
      activityName: editingEntry.activityName.trim(),
      groupName: String(editingEntry.groupName || '').trim(),
      spaceName: resolvedSpaceName,
      location: resolvedSpaceName,
      notes: String(editingEntry.notes || '').trim(),
      assignedEmails: normalizedAssignedEmails,
      assignedEmail: normalizedAssignedEmails[0] || '',
      createdByInitials: editingEntry.createdByInitials || actorInitials,
    }

    const conflict = validateConflicts(basePayload, targetDates)
    if (conflict) {
      alert(conflict)
      return
    }

    setSaving(true)
    try {
      await setTimetableEntries(prev => {
        const updates = []

        for (const date of targetDates) {
          const keepCurrentId = Boolean(editingEntry.id) && date === (editingEntry.dayDate || selectedDate)
          updates.push({
            ...basePayload,
            id: keepCurrentId ? editingEntry.id : crypto.randomUUID(),
            dayDate: date,
          })
        }

        const byId = new Map(prev.map(item => [item.id, item]))
        for (const update of updates) {
          byId.set(update.id, { ...(byId.get(update.id) || {}), ...update })
        }

        return [...byId.values()]
      })
      closeEditor()
    } catch (error) {
      alert(error.message || 'Failed to save timetable entry')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(entry) {
    if (!canEdit) {
      alert('Only owner/admin accounts can edit timetables.')
      return
    }
    if (!window.confirm('Delete this timetable entry?')) return
    try {
      await setTimetableEntries(prev => prev.filter(item => item.id !== entry.id))
    } catch (error) {
      alert(error.message || 'Failed to delete timetable entry')
    }
  }

  async function addSpace() {
    if (!canEdit) return
    const name = String(newSpaceName || '').trim()
    if (!name) return

    const exists = spaceOptions.some(space => normalizeText(space) === normalizeText(name))
    if (exists) {
      setNewSpaceName('')
      return
    }

    const maxOrder = persistedSpaceRecords.reduce((max, space) => Math.max(max, space.sortOrder), 0)

    try {
      await setTimetableSpaces(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name,
          sortOrder: maxOrder + 10,
        },
      ])
      setNewSpaceName('')
    } catch (error) {
      alert(error.message || 'Failed to add space')
    }
  }

  async function moveSpace(name, direction) {
    if (!canEdit) return

    const ordered = [...persistedSpaceRecords].sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name))
    const index = ordered.findIndex(space => normalizeText(space.name) === normalizeText(name))
    if (index < 0) return

    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= ordered.length) return

    const current = ordered[index]
    const other = ordered[swapIndex]

    try {
      await setTimetableSpaces(prev => prev.map(space => {
        if (space.id === current.id) return { ...space, sortOrder: other.sortOrder }
        if (space.id === other.id) return { ...space, sortOrder: current.sortOrder }
        return space
      }))
    } catch (error) {
      alert(error.message || 'Failed to reorder space')
    }
  }

  async function removeSpace(name) {
    if (!canEdit) return
    const normalizedName = normalizeText(name)
    const affectedEntries = timetableEntries.filter(entry => normalizeText(entrySpaceName(entry)) === normalizedName)
    const existing = timetableSpaces.find(space => normalizeText(space.name) === normalizedName)

    if (affectedEntries.length > 0) {
      const shouldDeleteEntries = window.confirm(
        `"${name}" has ${affectedEntries.length} scheduled block(s). Remove this space and delete those blocks?`
      )
      if (!shouldDeleteEntries) return
    } else if (!window.confirm(`Remove space "${name}"?`)) {
      return
    }

    try {
      if (affectedEntries.length > 0) {
        await setTimetableEntries(prev => prev.filter(entry => normalizeText(entrySpaceName(entry)) !== normalizedName))
      }

      if (existing) {
        await setTimetableSpaces(prev => prev.filter(space => space.id !== existing.id))
      }
    } catch (error) {
      alert(error.message || 'Failed to remove space')
    }
  }

  async function clearTimetableData() {
    if (!canEdit) return
    const confirmed = window.confirm('Clear all timetable blocks and spaces? This cannot be undone.')
    if (!confirmed) return

    const secondConfirm = window.confirm('Final check: delete every timetable block and every managed space now?')
    if (!secondConfirm) return

    try {
      await setTimetableEntries(() => [])
      await setTimetableSpaces(() => [])
      alert('Timetable cleared.')
    } catch (error) {
      alert(error.message || 'Failed to clear timetable data')
    }
  }

  async function duplicateDayToTarget() {
    if (!canEdit) return
    if (!duplicateTargetDate || duplicateTargetDate === selectedDate) {
      alert('Choose a different target date.')
      return
    }

    const sourceEntries = timetableEntries.filter(entry => (entry.dayDate || entry.day_date) === selectedDate)
    if (sourceEntries.length === 0) {
      alert('No entries on selected day to duplicate.')
      return
    }

    const existingTarget = timetableEntries.some(entry => (entry.dayDate || entry.day_date) === duplicateTargetDate)
    if (existingTarget && !window.confirm('Target day already has entries. Keep both sets?')) {
      return
    }

    try {
      await setTimetableEntries(prev => [
        ...prev,
        ...sourceEntries.map(entry => ({
          ...entry,
          id: crypto.randomUUID(),
          dayDate: duplicateTargetDate,
        })),
      ])
      alert('Day duplicated.')
    } catch (error) {
      alert(error.message || 'Failed to duplicate day')
    }
  }

  function entriesForColumnAtSlot(column, slotStart, slotEnd) {
    if (viewMode === 'space') {
      return dayEntries.filter(entry => normalizeText(entrySpaceName(entry)) === normalizeText(column) && isActiveInRange(entry, slotStart, slotEnd))
    }

    const email = column.email
    return dayEntries.filter(entry => normalizeAssignedEmails(entry).includes(email) && isActiveInRange(entry, slotStart, slotEnd))
  }

  function printDaySchedule() {
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=980,height=760')
    if (!popup) {
      alert('Unable to open print window. Please allow pop-ups for this site.')
      return
    }

    const sorted = [...dayEntries].sort((a, b) => String(a.startTime || a.start_time || '').localeCompare(String(b.startTime || b.start_time || '')))
    const rows = sorted.map(entry => {
      const assigned = normalizeAssignedEmails(entry)
        .map(email => allStaffOptions.find(option => option.email === email)?.label || email)
        .join(', ')

      return `
        <tr>
          <td>${escapeHtml(entry.startTime || entry.start_time || '')} - ${escapeHtml(entry.endTime || entry.end_time || '')}</td>
          <td>${escapeHtml(entry.activityName || entry.activity_name || '')}</td>
          <td>${escapeHtml(entry.groupName || entry.group_name || '')}</td>
          <td>${escapeHtml(entrySpaceName(entry))}</td>
          <td>${escapeHtml(assigned)}</td>
          <td>${escapeHtml(entry.notes || '')}</td>
        </tr>
      `
    }).join('')

    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Schedule ${escapeHtml(selectedDate)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #1f2937; }
    h1 { font-size: 20px; margin: 0 0 4px 0; }
    p { margin: 0 0 16px 0; color: #4b5563; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>Staff Schedule</h1>
  <p>${escapeHtml(fmtDateLabel(selectedDate))} (${escapeHtml(viewMode === 'space' ? 'By Space' : 'By Staff')})</p>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Activity</th>
        <th>Group</th>
        <th>Space</th>
        <th>Staff</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6">No schedule entries for this day.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`)
    popup.document.close()
    popup.focus()
    popup.print()
  }

  function renderEntryCard(entry) {
    const assignedNames = normalizeAssignedEmails(entry)
      .map(email => allStaffOptions.find(option => option.email === email)?.label || email)
      .join(', ')

    const isConflicting = conflictSummary.entryConflictIds.has(entry.id)
    const spaceColor = colorForSpace(entrySpaceName(entry))

    return (
      <div
        key={entry.id}
        onDoubleClick={() => openEdit(entry)}
        style={{ backgroundColor: isConflicting ? '#ffe4e6' : spaceColor }}
        className={`rounded-lg border px-2 py-1.5 text-xs ${isConflicting ? 'border-rose-300 text-rose-900' : 'border-emerald-200 text-emerald-900'}`}
      >
        <p className="font-semibold leading-tight">{entry.activityName || entry.activity_name}</p>
        <p className="mt-0.5 text-[11px]">
          {entry.startTime || entry.start_time}
          {(entry.endTime || entry.end_time) ? `-${entry.endTime || entry.end_time}` : ''}
          {(entry.groupName || entry.group_name) ? ` · ${entry.groupName || entry.group_name}` : ''}
        </p>
        <p className="text-[11px]">{entrySpaceName(entry)}</p>
        {viewMode === 'space' && assignedNames && (
          <p className="text-[11px]">{assignedNames}</p>
        )}
        {isConflicting && (
          <p className="mt-1 text-[11px] font-semibold">Double-booked staff overlap</p>
        )}
        {canEdit && (
          <div className="mt-1 flex items-center gap-1">
            <button onClick={() => openEdit(entry)} className="p-1 rounded hover:bg-white/60" title="Edit">
              <Pencil size={12} />
            </button>
            <button onClick={() => deleteEntry(entry)} className="p-1 rounded hover:bg-white/70 text-rose-700" title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in space-y-5">
      {editingEntry && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-3xl fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div>
                <h3 className="font-display font-bold text-forest-950">{editingEntry.id ? 'Edit Schedule Block' : 'New Schedule Block'}</h3>
                <p className="text-xs text-stone-500 mt-1">{fmtDateLabel(editingEntry.dayDate || selectedDate)}</p>
              </div>
              <button onClick={closeEditor} className="text-stone-400 hover:text-stone-700 p-1"><X size={20} /></button>
            </div>

            <form onSubmit={saveEntry} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={editingEntry.dayDate} onChange={e => setField('dayDate', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Start *</label>
                  <input type="time" className="input" min="09:45" max="16:30" step="300" value={editingEntry.startTime} onChange={e => setField('startTime', e.target.value)} required />
                </div>
                <div>
                  <label className="label">End *</label>
                  <input type="time" className="input" min="09:45" max="16:30" step="300" value={editingEntry.endTime} onChange={e => setField('endTime', e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="label">Usual blocks (quick set)</label>
                <div className="flex flex-wrap gap-2">
                  {USUAL_BLOCKS.map(([start, end]) => (
                    <button key={`${start}-${end}`} type="button" onClick={() => applyUsualBlock(start, end)} className="px-2 py-1 text-xs rounded border border-stone-300 text-stone-700 hover:border-forest-400 hover:text-forest-900">
                      {start} - {end}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Activity *</label>
                  <input className="input" value={editingEntry.activityName} onChange={e => setField('activityName', e.target.value)} placeholder="Warm-up, lunch, run-through" required />
                </div>
                <div>
                  <label className="label">Group</label>
                  <input className="input" value={editingEntry.groupName} onChange={e => setField('groupName', e.target.value)} placeholder="Juniors / Seniors / Whole team" />
                </div>
                <div>
                  <label className="label">Space *</label>
                  <select className="input" value={editingEntry.spaceName} onChange={e => setField('spaceName', e.target.value)} required>
                    {spaceOptions.map(space => (
                      <option key={space} value={space}>{space}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
                {editingEntry.spaceName === 'Other' && (
                  <div>
                    <label className="label">Other space name *</label>
                    <input className="input" value={editingEntry.customSpaceName} onChange={e => setField('customSpaceName', e.target.value)} placeholder="Type custom space" required />
                  </div>
                )}
              </div>

              <div>
                <label className="label">Assign Staff (multiple) *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-stone-200 p-3 max-h-44 overflow-auto">
                  {allStaffOptions.map(option => (
                    <label key={option.email} className="inline-flex items-center gap-2 text-sm text-forest-900">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={editingEntry.assignedEmails.includes(option.email)}
                        onChange={() => toggleAssigned(option.email)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={editingEntry.notes} onChange={e => setField('notes', e.target.value)} placeholder="Break cover, sign-in duty, handover notes..." />
              </div>

              <div className="rounded-xl border border-stone-200 p-3 space-y-3">
                <label className="inline-flex items-center gap-2 text-sm text-forest-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={editingEntry.applyToRange}
                    onChange={e => setField('applyToRange', e.target.checked)}
                  />
                  Apply to multiple days
                </label>

                {editingEntry.applyToRange && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Range start</label>
                        <input type="date" className="input" value={editingEntry.rangeStartDate} onChange={e => setField('rangeStartDate', e.target.value)} required />
                      </div>
                      <div>
                        <label className="label">Range end</label>
                        <input type="date" className="input" value={editingEntry.rangeEndDate} onChange={e => setField('rangeEndDate', e.target.value)} required />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <label key={day} className="inline-flex items-center gap-2 text-sm text-forest-900 px-2 py-1 rounded border border-stone-200">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={Boolean(editingEntry.weekdays[day])}
                            onChange={() => toggleWeekday(day)}
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Block'}</button>
                <button type="button" className="btn-secondary" onClick={closeEditor}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Staff Schedule</h2>
          <p className="text-stone-500 text-sm">
            {canEdit
              ? 'Manage schedule blocks across people and spaces.'
              : canSeeOverview
                ? 'Read-only overview of full daily schedules.'
                : 'Your own schedule for the selected day.'}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={printDaySchedule} className="btn-secondary flex items-center justify-center gap-2 flex-1 sm:flex-none">
            <Printer size={15} /> Print / PDF
          </button>
          {canEdit && (
            <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2 flex-1 sm:flex-none">
              <Plus size={15} /> Add Block
            </button>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(prev => addDays(prev, -1))} className="btn-secondary px-2 py-2"><ChevronLeft size={16} /></button>
          <div className="flex-1 text-center">
            <p className="font-display font-semibold text-forest-950 flex items-center justify-center gap-2">
              <CalendarDays size={15} /> {fmtDateLabel(selectedDate)}
            </p>
            <div className="mt-2">
              <button
                onClick={() => setSelectedDate(todayKey())}
                disabled={selectedDate === todayKey()}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Today
              </button>
            </div>
          </div>
          <button onClick={() => setSelectedDate(prev => addDays(prev, 1))} className="btn-secondary px-2 py-2"><ChevronRight size={16} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {canSeeOverview && (
            <div>
              <label className="label">Overview mode</label>
              <div className="flex gap-2">
                <button onClick={() => setViewMode('staff')} className={`btn-secondary text-sm ${viewMode === 'staff' ? 'bg-forest-900 text-white border-forest-900' : ''}`}>By Staff</button>
                <button onClick={() => setViewMode('space')} className={`btn-secondary text-sm ${viewMode === 'space' ? 'bg-forest-900 text-white border-forest-900' : ''}`}>By Space</button>
              </div>
            </div>
          )}
        </div>

        {canSeeOverview && viewMode === 'staff' && (
          <div>
            <label className="label">Filter staff</label>
            <select className="input" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
              <option value="all">All staff</option>
              {allStaffOptions.map(option => (
                <option key={option.email} value={option.email}>{option.label}</option>
              ))}
            </select>
          </div>
        )}

        {canSeeOverview && viewMode === 'space' && (
          <div>
            <label className="label">Filter space</label>
            <select className="input" value={spaceFilter} onChange={e => setSpaceFilter(e.target.value)}>
              <option value="all">All spaces</option>
              {spaceOptions.map(space => (
                <option key={space} value={space}>{space}</option>
              ))}
            </select>
          </div>
        )}

        {canEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100">
            <div>
              <label className="label">Duplicate selected day</label>
              <div className="flex gap-2">
                <input type="date" className="input" value={duplicateTargetDate} onChange={e => setDuplicateTargetDate(e.target.value)} />
                <button onClick={duplicateDayToTarget} className="btn-secondary flex items-center gap-1"><Copy size={14} /> Duplicate</button>
              </div>
            </div>
            <div>
              <label className="label">Manage spaces</label>
              <div className="flex gap-2">
                <input className="input" value={newSpaceName} onChange={e => setNewSpaceName(e.target.value)} placeholder="Add space" />
                <button onClick={addSpace} className="btn-secondary">Add</button>
              </div>
              <div className="mt-2">
                <button onClick={clearTimetableData} className="btn-secondary text-rose-700 border-rose-300 hover:bg-rose-50">
                  Clear Entire Timetable
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {spaceOptions.map((space, idx) => {
                  const isPersisted = persistedSpaceRecords.some(record => normalizeText(record.name) === normalizeText(space))
                  return (
                    <div key={space} className="flex items-center justify-between px-2 py-1 text-xs rounded border border-stone-200 text-stone-700">
                      <div className="flex items-center gap-2">
                        <span>{space}</span>
                        <input
                          type="color"
                          value={colorForSpace(space)}
                          onChange={e => updateSpaceColor(space, e.target.value)}
                          className="h-6 w-6 rounded border border-stone-300 bg-white p-0"
                          title="Set block color for this space"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={!isPersisted || idx === 0}
                          onClick={() => moveSpace(space, 'up')}
                          className="p-1 rounded hover:bg-stone-100 disabled:opacity-40"
                          title="Move up"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          disabled={!isPersisted || idx === spaceOptions.length - 1}
                          onClick={() => moveSpace(space, 'down')}
                          className="p-1 rounded hover:bg-stone-100 disabled:opacity-40"
                          title="Move down"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onClick={() => removeSpace(space)}
                          className="p-1 rounded hover:bg-rose-50 text-rose-700"
                          title={isPersisted ? 'Remove space' : 'Remove this legacy space and any blocks in it'}
                        >
                          x
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {conflictSummary.slotAlerts.length > 0 && (
        <div className="card border border-rose-200 bg-rose-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-rose-700" />
            <h3 className="font-semibold text-rose-900">Double-booked staff alerts</h3>
          </div>
          <div className="space-y-1 text-xs text-rose-900">
            {conflictSummary.slotAlerts.map(item => (
              <p key={`${item.slot}-${item.staff.join('|')}`}><span className="font-semibold">{item.slot}</span>: {item.staff.join(', ')}</p>
            ))}
          </div>
        </div>
      )}

      {columns.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-stone-500 text-sm">No timetable columns available for this view/filter.</p>
        </div>
      ) : (
        <div className="card overflow-auto p-0">
          <table className="min-w-[960px] w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-stone-50 border-b border-r border-stone-200 px-3 py-2 text-left text-xs font-semibold text-stone-600 w-28">Time</th>
                {columns.map(column => (
                  <th key={viewMode === 'space' ? column : column.email} className="bg-stone-50 border-b border-stone-200 px-3 py-2 text-left text-xs font-semibold text-stone-600 min-w-[220px]">
                    {viewMode === 'space' ? column : column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const renderedEntries = new Set()
                return timeRows.map((row, rowIdx) => (
                  <tr key={row.startLabel}>
                    <td className="sticky left-0 z-10 bg-white border-r border-b border-stone-200 px-3 py-2 align-top text-xs font-medium text-stone-500">
                      {row.startLabel} - {row.endLabel}
                    </td>
                    {columns.map(column => {
                      const key = viewMode === 'space' ? column : column.email
                      const allEntriesInColumn = dayEntries.filter(entry => 
                        (viewMode === 'space' 
                          ? normalizeText(entrySpaceName(entry)) === normalizeText(column)
                          : normalizeAssignedEmails(entry).includes(column.email)
                        ) && isActiveInRange(entry, row.startMinutes, row.endMinutes)
                      )
                      const entriesToRender = allEntriesInColumn.filter(entry => {
                        if (renderedEntries.has(entry.id)) return false
                        const entryStart = timeToMinutes(entry.startTime || entry.start_time)
                        return entryStart >= row.startMinutes && entryStart < row.endMinutes
                      })
                      const entriesWithSpan = entriesToRender.map(entry => {
                        const entryStart = timeToMinutes(entry.startTime || entry.start_time)
                        const entryEnd = timeToMinutes(entry.endTime || entry.end_time)
                        let rowSpan = 1
                        for (let i = rowIdx + 1; i < timeRows.length; i++) {
                          if (entryEnd > timeRows[i].startMinutes) rowSpan++
                          else break
                        }
                        renderedEntries.add(entry.id)
                        return { entry, rowSpan }
                      })
                      if (entriesWithSpan.length === 0 && allEntriesInColumn.length === 0) {
                        return (
                          <td key={`${row.startLabel}-${key}`} onDoubleClick={() => { if (!canEdit) return; openCreateAtSlot(column, row.startLabel, row.endLabel) }} className="border-b border-stone-200 px-2 py-1 align-top h-14 cursor-pointer" title={canEdit ? 'Double-click to add/edit this slot' : ''}>
                            <div className="h-full min-h-8 rounded border border-dashed border-stone-200 hover:border-forest-300" />
                          </td>
                        )
                      }
                      if (entriesWithSpan.length > 0) {
                        return (
                          <td key={`${row.startLabel}-${key}`} rowSpan={Math.max(...entriesWithSpan.map(e => e.rowSpan))} onDoubleClick={() => { if (!canEdit) return; entriesWithSpan.length > 0 ? openEdit(entriesWithSpan[0].entry) : openCreateAtSlot(column, row.startLabel, row.endLabel) }} className="border-b border-stone-200 px-2 py-1 align-top cursor-pointer hover:bg-stone-50 transition-colors" title={canEdit ? 'Double-click to add/edit' : ''}>
                            <div className="space-y-1">
                              {entriesWithSpan.map(({ entry }) => renderEntryCard(entry))}
                            </div>
                          </td>
                        )
                      }
                      return null
                    }).filter(Boolean)}
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
