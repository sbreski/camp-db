import { useState, useMemo } from 'react'
import { X, Plus, ChevronUp, ChevronDown } from 'lucide-react'
import ParticipantNameText from './ParticipantNameText'
import { isIncludedThisSeason } from './AttendanceOverview'

function genderOf(p) {
  const pr = String(p.pronouns || '').trim().toLowerCase()
  if (pr === 'he/him') return 'm'
  if (pr === 'she/her') return 'f'
  return 'nb'
}

const GENDER_COLORS = {
  m:  { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200' },
  f:  { bg: 'bg-pink-50',   text: 'text-pink-800',   border: 'border-pink-200' },
  nb: { bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-200' },
}

const GENDER_LABELS = {
  m: 'Male',
  f: 'Female',
  nb: 'Non-binary / other',
}

const AGE_GROUPS = [
  { id: 'under-10', label: 'Under 10', min: 0, max: 9 },
  { id: '10-12', label: '10-12', min: 10, max: 12 },
  { id: '13-15', label: '13-15', min: 13, max: 15 },
  { id: '16-plus', label: '16+', min: 16, max: Infinity },
  { id: 'unknown', label: 'Unknown age', min: null, max: null },
]

const GROUP_BY_OPTIONS = [
  { id: 'gender', label: 'Gender' },
  { id: 'age', label: 'Age group' },
]

function ageGroupOf(age) {
  if (age === null || age === undefined || Number.isNaN(Number(age))) return 'unknown'
  const numericAge = Number(age)
  const match = AGE_GROUPS.find(g => g.min !== null && numericAge >= g.min && numericAge <= g.max)
  return match ? match.id : 'unknown'
}

function ageGroupLabel(age) {
  const id = ageGroupOf(age)
  return AGE_GROUPS.find(g => g.id === id)?.label || 'Unknown age'
}

export default function DressingRooms({ participants }) {
  const [sortKey, setSortKey] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [genderFilter, setGenderFilter] = useState(new Set(['m', 'f', 'nb']))
  const [ageFilter, setAgeFilter] = useState(new Set(AGE_GROUPS.map(g => g.id)))
  const [highlightBy, setHighlightBy] = useState('gender')
  const [viewMode, setViewMode] = useState('table')
  const [groupBy, setGroupBy] = useState('gender')
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

    // Memoized list of included participants
    const includedParticipants = useMemo(() => participants.filter(isIncludedThisSeason), [participants])

    // Helper: get participant's age (if available)
    function getAge(p) {
      const parsedAge = Number.parseInt(p.age, 10)
      if (!Number.isNaN(parsedAge)) return parsedAge
      return p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
    }

    // Helper: find which room a participant is in
    function getParticipantRoomId(participantId) {
      const room = rooms.find(r => r.participants.some(p => p.id === participantId))
      return room ? room.id : ''
    }

    // Assign participant to a room (from list)
    function assignParticipantToRoom(participant, roomId) {
      // Remove from all rooms first
      setRooms(prev => prev.map(r => ({
        ...r,
        participants: r.participants.filter(p => p.id !== participant.id)
      })))
      // Then add to selected room
      if (roomId) {
        setRooms(prev => prev.map(r =>
          r.id === roomId
            ? { ...r, participants: [...r.participants, participant] }
            : r
        ))
      }
    }

    function toggleSort(nextKey) {
      if (sortKey === nextKey) {
        setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
        return
      }
      setSortKey(nextKey)
      setSortDirection('asc')
    }

    function toggleGenderFilter(gender) {
      setGenderFilter(prev => {
        const next = new Set(prev)
        if (next.has(gender)) {
          if (next.size > 1) next.delete(gender)
        } else {
          next.add(gender)
        }
        return next
      })
    }

    function toggleAgeFilter(ageGroupId) {
      setAgeFilter(prev => {
        const next = new Set(prev)
        if (next.has(ageGroupId)) {
          if (next.size > 1) next.delete(ageGroupId)
        } else {
          next.add(ageGroupId)
        }
        return next
      })
    }

    function clearGroupFilters() {
      setGenderFilter(new Set(['m', 'f', 'nb']))
      setAgeFilter(new Set(AGE_GROUPS.map(g => g.id)))
    }

    function compareBySort(a, b) {
      const multiplier = sortDirection === 'asc' ? 1 : -1
      const nameA = String(a.name || '').trim()
      const nameB = String(b.name || '').trim()

      if (sortKey === 'age') {
        const ageA = getAge(a)
        const ageB = getAge(b)
        if (ageA === null && ageB === null) return nameA.localeCompare(nameB)
        if (ageA === null) return 1
        if (ageB === null) return -1
        if (ageA !== ageB) return (ageA - ageB) * multiplier
        return nameA.localeCompare(nameB)
      }

      if (sortKey === 'gender') {
        const genderA = genderOf(a)
        const genderB = genderOf(b)
        if (genderA !== genderB) return genderA.localeCompare(genderB) * multiplier
        return nameA.localeCompare(nameB)
      }

      return nameA.localeCompare(nameB) * multiplier
    }

    const sortedIncludedParticipants = useMemo(
      () => [...includedParticipants].sort(compareBySort),
      [includedParticipants, sortKey, sortDirection]
    )

    const visibleParticipants = useMemo(() => (
      sortedIncludedParticipants.filter(participant => {
        const participantAge = getAge(participant)
        return genderFilter.has(genderOf(participant)) && ageFilter.has(ageGroupOf(participantAge))
      })
    ), [sortedIncludedParticipants, genderFilter, ageFilter])

    const genderCounts = useMemo(() => {
      const counts = { m: 0, f: 0, nb: 0 }
      includedParticipants.forEach(participant => {
        counts[genderOf(participant)] += 1
      })
      return counts
    }, [includedParticipants])

    const ageGroupCounts = useMemo(() => {
      const counts = {}
      AGE_GROUPS.forEach(group => { counts[group.id] = 0 })
      includedParticipants.forEach(participant => {
        const group = ageGroupOf(getAge(participant))
        counts[group] += 1
      })
      return counts
    }, [includedParticipants])

    const groupedParticipants = useMemo(() => {
      const groups = new Map()
      visibleParticipants.forEach(participant => {
        const key = groupBy === 'gender' ? genderOf(participant) : ageGroupOf(getAge(participant))
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(participant)
      })

      const orderedKeys = groupBy === 'gender'
        ? ['m', 'f', 'nb']
        : AGE_GROUPS.map(g => g.id)

      return orderedKeys
        .filter(key => groups.has(key))
        .map(key => ({ key, participants: groups.get(key) }))
    }, [visibleParticipants, groupBy])

    function groupLabel(groupKey) {
      if (groupBy === 'gender') return GENDER_LABELS[groupKey] || 'Other'
      return AGE_GROUPS.find(g => g.id === groupKey)?.label || 'Other'
    }

    function toggleGroup(groupKey) {
      setCollapsedGroups(prev => {
        const next = new Set(prev)
        if (next.has(groupKey)) next.delete(groupKey)
        else next.add(groupKey)
        return next
      })
    }

    function expandAllGroups() {
      setCollapsedGroups(new Set())
    }

    function collapseAllGroups() {
      setCollapsedGroups(new Set(groupedParticipants.map(group => group.key)))
    }

    function rowGroupClass(participant) {
      if (highlightBy === 'none') return ''
      if (highlightBy === 'gender') {
        const g = genderOf(participant)
        if (g === 'm') return 'bg-blue-50/40'
        if (g === 'f') return 'bg-pink-50/40'
        return 'bg-violet-50/40'
      }

      const group = ageGroupOf(getAge(participant))
      if (group === 'under-10') return 'bg-emerald-50/50'
      if (group === '10-12') return 'bg-cyan-50/50'
      if (group === '13-15') return 'bg-amber-50/50'
      if (group === '16-plus') return 'bg-rose-50/50'
      return 'bg-stone-50/60'
    }

    function SortHeader({ label, columnKey }) {
      const active = sortKey === columnKey
      return (
        <button
          type="button"
          onClick={() => toggleSort(columnKey)}
          className={`inline-flex items-center gap-1 transition-colors ${active ? 'text-forest-800' : 'text-stone-600 hover:text-stone-800'}`}
          aria-label={`Sort by ${label}`}
        >
          <span>{label}</span>
          {active && (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </button>
      )
    }

  const [rooms, setRooms] = useState(() => {
    const initialRooms = []
    for (let i = 1; i <= 5; i++) {
      initialRooms.push({ id: `room-${i}`, name: `Room ${i}`, participants: [] })
    }
    return initialRooms
  })
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [searchParticipant, setSearchParticipant] = useState('')

  function addParticipantToRoom(roomId, participant) {
    // Remove from all rooms first, then add to selected room
    setRooms(prev => prev.map(r => ({
      ...r,
      participants: r.participants.filter(p => p.id !== participant.id)
    })))
    setRooms(prev => prev.map(r =>
      r.id === roomId
        ? { ...r, participants: [...r.participants, participant] }
        : r
    ))
    setSearchParticipant('')
  }

  function removeParticipantFromRoom(roomId, participantId) {
    setRooms(prev => prev.map(r => {
      if (r.id === roomId) {
        return { ...r, participants: r.participants.filter(p => p.id !== participantId) }
      }
      return r
    }))
  }

  function updateRoomName(roomId, newName) {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, name: newName } : r))
  }

  function getParticipantsNotInRoom(roomId) {
    const inRoom = rooms.find(r => r.id === roomId)?.participants || []
    const inRoomIds = new Set(inRoom.map(p => p.id))
    return participants.filter(p => !inRoomIds.has(p.id))
  }

  const currentRoom = rooms.find(r => r.id === selectedRoom)

  return (
    <div className="fade-in space-y-4">
      <div>
        <h2 className="text-2xl font-display font-bold text-forest-950">Dressing Rooms</h2>
        <p className="text-stone-500 text-sm mt-1">Organise participants into dressing rooms</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {rooms.map(room => (
          <button
            key={room.id}
            onClick={() => setSelectedRoom(room.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              selectedRoom === room.id
                ? 'border-forest-600 bg-forest-50'
                : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <h3 className="font-display font-semibold text-forest-950 text-sm">{room.name}</h3>
            <p className="text-xs text-stone-500 mt-1">{room.participants.length} participant{room.participants.length !== 1 ? 's' : ''}</p>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {room.participants.map(p => (
                <div key={p.id} className="text-xs bg-forest-100 text-forest-900 rounded px-2 py-1 truncate">
                  <ParticipantNameText participant={p} showDiagnosedHighlight={false} className="text-xs text-forest-900" />
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Included Participants List with Room Selector */}
      <div className="mt-8">
        <h3 className="font-display font-semibold text-forest-950 text-lg mb-2">Assign Participants to Rooms</h3>
        <div className="mb-3 rounded-lg border border-stone-200 bg-white p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">Gender filters:</span>
            {(['m', 'f', 'nb']).map(g => {
              const c = GENDER_COLORS[g]
              const active = genderFilter.has(g)
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenderFilter(g)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    active
                      ? `${c.bg} ${c.text} ${c.border}`
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <span>{GENDER_LABELS[g]}</span>
                  <span className="text-[10px] opacity-80">{genderCounts[g]}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">Age filters:</span>
            {AGE_GROUPS.map(group => {
              const active = ageFilter.has(group.id)
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => toggleAgeFilter(group.id)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-forest-900 text-white border-forest-900'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <span>{group.label}</span>
                  <span className="text-[10px] opacity-80">{ageGroupCounts[group.id]}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">Highlight rows by:</span>
            <select
              className="input py-1.5 text-sm w-auto"
              value={highlightBy}
              onChange={e => setHighlightBy(e.target.value)}
            >
              <option value="gender">Gender</option>
              <option value="age">Age group</option>
              <option value="none">None</option>
            </select>
            <button
              type="button"
              onClick={clearGroupFilters}
              className="text-xs text-rose-700 hover:text-rose-900 underline"
            >
              Reset filters
            </button>
            <span className="text-xs text-stone-500">
              Showing {visibleParticipants.length} of {includedParticipants.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-500">View mode:</span>
            <div className="inline-flex rounded-md border border-stone-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-xs font-semibold ${viewMode === 'table' ? 'bg-forest-900 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1 text-xs font-semibold border-l border-stone-200 ${viewMode === 'grouped' ? 'bg-forest-900 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
              >
                Grouped
              </button>
            </div>

            {viewMode === 'grouped' && (
              <>
                <span className="text-xs font-semibold text-stone-500 ml-1">Group by:</span>
                <select
                  className="input py-1.5 text-sm w-auto"
                  value={groupBy}
                  onChange={e => {
                    setGroupBy(e.target.value)
                    setCollapsedGroups(new Set())
                  }}
                >
                  {GROUP_BY_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <button type="button" onClick={expandAllGroups} className="text-xs text-stone-600 hover:text-stone-800 underline">Expand all</button>
                <button type="button" onClick={collapseAllGroups} className="text-xs text-stone-600 hover:text-stone-800 underline">Collapse all</button>
              </>
            )}
          </div>
        </div>
        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-stone-200 rounded-lg">
              <thead>
                <tr className="bg-stone-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-600"><SortHeader label="Name" columnKey="name" /></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-600"><SortHeader label="Age" columnKey="age" /></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-600"><SortHeader label="Pronouns" columnKey="gender" /></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-stone-600">Room</th>
                </tr>
              </thead>
              <tbody>
                {visibleParticipants.map(p => (
                  <tr key={p.id} className={`border-t border-stone-100 ${rowGroupClass(p)}`}>
                    <td className="px-3 py-2"><ParticipantNameText participant={p} showDiagnosedHighlight={false} className="font-medium text-sm text-stone-900" /></td>
                    <td className="px-3 py-2">
                      {getAge(p) !== null ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-semibold text-stone-800">{getAge(p)}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-stone-200 bg-white text-stone-600">
                            {ageGroupLabel(getAge(p))}
                          </span>
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.pronouns
                        ? (() => {
                            const c = GENDER_COLORS[genderOf(p)]
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
                                {GENDER_LABELS[genderOf(p)]}: {p.pronouns}
                              </span>
                            )
                          })()
                        : <span className="text-stone-400">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="input"
                        value={getParticipantRoomId(p.id)}
                        onChange={e => assignParticipantToRoom(p, e.target.value)}
                      >
                        <option value="">No room</option>
                        {rooms.map(room => (
                          <option key={room.id} value={room.id}>{room.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {visibleParticipants.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-stone-500">
                      No participants match the selected age and gender filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedParticipants.map(group => {
              const collapsed = collapsedGroups.has(group.key)
              return (
                <div key={group.key} className="border border-stone-200 rounded-lg bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="w-full px-3 py-2.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-forest-900">{groupLabel(group.key)}</span>
                      <span className="text-xs text-stone-500">{group.participants.length} participant{group.participants.length === 1 ? '' : 's'}</span>
                    </div>
                    {collapsed ? <ChevronDown size={16} className="text-stone-500" /> : <ChevronUp size={16} className="text-stone-500" />}
                  </button>

                  {!collapsed && (
                    <div className="divide-y divide-stone-100">
                      {group.participants.map(p => (
                        <div key={p.id} className={`px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${rowGroupClass(p)}`}>
                          <div className="flex-1 min-w-0">
                            <ParticipantNameText participant={p} showDiagnosedHighlight={false} className="font-medium text-sm text-stone-900" />
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {getAge(p) !== null ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-stone-200 bg-white text-stone-700">
                                  Age {getAge(p)} · {ageGroupLabel(getAge(p))}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-stone-200 bg-white text-stone-500">
                                  Age unknown
                                </span>
                              )}
                              {p.pronouns && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${GENDER_COLORS[genderOf(p)].bg} ${GENDER_COLORS[genderOf(p)].text} ${GENDER_COLORS[genderOf(p)].border}`}>
                                  {GENDER_LABELS[genderOf(p)]}: {p.pronouns}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="sm:w-56">
                            <select
                              className="input"
                              value={getParticipantRoomId(p.id)}
                              onChange={e => assignParticipantToRoom(p, e.target.value)}
                            >
                              <option value="">No room</option>
                              {rooms.map(room => (
                                <option key={room.id} value={room.id}>{room.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {groupedParticipants.length === 0 && (
              <div className="border border-stone-200 rounded-lg bg-white px-3 py-6 text-center text-sm text-stone-500">
                No participants match the selected age and gender filters.
              </div>
            )}
          </div>
        )}
      </div>

      {currentRoom && (
        <div className="card border-2 border-forest-200 fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <label className="label text-xs mb-1">Room Name</label>
              <input
                className="input font-display font-semibold text-lg"
                value={currentRoom.name}
                onChange={e => updateRoomName(currentRoom.id, e.target.value)}
              />
            </div>
            <button onClick={() => setSelectedRoom(null)} className="p-1 text-stone-400 hover:text-stone-600 ml-2">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Add Participant</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Search participants..."
                  value={searchParticipant}
                  onChange={e => setSearchParticipant(e.target.value)}
                />
              </div>
              {searchParticipant && (
                <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
                  {getParticipantsNotInRoom(currentRoom.id)
                    .filter(p => p.name.toLowerCase().includes(searchParticipant.toLowerCase()))
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => addParticipantToRoom(currentRoom.id, p)}
                        className="w-full text-left px-4 py-2 hover:bg-amber-50 border-b border-stone-100 last:border-b-0 transition-all flex items-center gap-2"
                      >
                        <Plus size={14} className="text-amber-500" />
                        <ParticipantNameText participant={p} showDiagnosedHighlight={false} className="text-sm font-medium text-stone-700" />
                        {p.pronouns && <span className="text-xs text-stone-500">({p.pronouns})</span>}
                      </button>
                    ))}
                  {getParticipantsNotInRoom(currentRoom.id).filter(p => p.name.toLowerCase().includes(searchParticipant.toLowerCase())).length === 0 && (
                    <div className="px-4 py-3 text-sm text-stone-500 text-center">No available participants</div>
                  )}
                </div>
              )}
            </div>

            <div>
              <h4 className="label mb-3">Participants in {currentRoom.name}</h4>
              {currentRoom.participants.length === 0 ? (
                <p className="text-sm text-stone-500 text-center py-4">No participants assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {currentRoom.participants.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-all"
                    >
                      <div className="min-w-0">
                        <ParticipantNameText participant={p} showDiagnosedHighlight={false} className="font-medium text-sm text-stone-900" />
                        {p.pronouns && <p className="text-xs text-stone-500">{p.pronouns}</p>}
                      </div>
                      <button
                        onClick={() => removeParticipantFromRoom(currentRoom.id, p.id)}
                        className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-all flex-shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
