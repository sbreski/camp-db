import { useState, Fragment } from 'react'
import { Users, Search, Mail } from 'lucide-react'

function parseApprovedAdults(str) {
  if (!str) return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

function stripParentSuffix(name) {
  return name.trim().replace(/\s*\(parent\)$/i, '').trim()
}

function hasSameAdult(list, name) {
  const normalized = stripParentSuffix(name).toLowerCase()
  return list.some(a => stripParentSuffix(a).toLowerCase() === normalized)
}

function formatParentLabel(name) {
  const clean = stripParentSuffix(name)
  return clean ? `${clean} (Parent)` : ''
}


export default function Parents({ participants, onUpdateParticipant }) {
  const [search, setSearch] = useState('')
  const [selectedParents, setSelectedParents] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editingAdults, setEditingAdults] = useState([])
  const [newAdult, setNewAdult] = useState('')
  const [sortBy, setSortBy] = useState('parent') // 'parent' or 'child'

  function toggleParentSelection(parentId) {
    const newSelected = new Set(selectedParents)
    if (newSelected.has(parentId)) {
      newSelected.delete(parentId)
    } else {
      newSelected.add(parentId)
    }
    setSelectedParents(newSelected)
  }

  function startEditing(participant) {
    const adults = parseApprovedAdults(participant.approvedAdults)
    if (participant.parentName && !hasSameAdult(adults, participant.parentName)) {
      adults.unshift(formatParentLabel(participant.parentName))
    }
    setEditingId(participant.id)
    setEditingAdults(adults)
    setNewAdult('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingAdults([])
    setNewAdult('')
  }

  function addAdult() {
    const trimmed = newAdult.trim()
    if (!trimmed) return
    if (!editingAdults.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      setEditingAdults(prev => [...prev, trimmed])
    }
    setNewAdult('')
  }

  function removeAdult(index) {
    setEditingAdults(prev => prev.filter((_, i) => i !== index))
  }

  function saveAdults(participant) {
    const normalized = [...editingAdults]
    if (participant.parentName && !hasSameAdult(normalized, participant.parentName)) {
      normalized.unshift(formatParentLabel(participant.parentName))
    }
    onUpdateParticipant(participant.id, normalized.join(', '))
    cancelEdit()
  }

  function emailSelectedParents() {
    const selectedEmails = filtered
      .filter(p => selectedParents.has(p.id))
      .map(p => p.parentEmail)
      .filter(email => email)

    if (selectedEmails.length === 0) return

    const bcc = selectedEmails.join(',')
    const mailtoLink = `mailto:?bcc=${encodeURIComponent(bcc)}`
    window.open(mailtoLink, '_blank')
  }

  function clearSelection() {
    setSelectedParents(new Set())
  }

  const filtered = participants
    .filter(p => p.parentName || p.parentEmail || p.parentPhone)
    .filter(p => {
      const query = search.toLowerCase()
      return !query ||
        p.parentName?.toLowerCase().includes(query) ||
        p.parentEmail?.toLowerCase().includes(query) ||
        p.parentPhone?.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query)
    })
    .sort((a, b) => {
      if (sortBy === 'parent') {
        return (a.parentName || '').localeCompare(b.parentName || '')
      } else {
        return (a.name || '').localeCompare(b.name || '')
      }
    })


  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Parents & Guardians</h2>
          <p className="text-stone-500 text-sm">{filtered.length} parent contacts</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <label className="text-sm text-stone-700 flex items-center gap-1">
            Sort by:
            <select
              className="input text-sm py-1 px-2 h-8"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="parent">Parent A-Z</option>
              <option value="child">Child A-Z</option>
            </select>
          </label>
          {selectedParents.size > 0 && (
            <>
              <span className="text-sm text-stone-600">{selectedParents.size} selected</span>
              <button onClick={emailSelectedParents} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
                <Mail size={14} /> Email Selected
              </button>
              <button onClick={clearSelection} className="btn-secondary text-sm w-full sm:w-auto">
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input type="text" placeholder="Search by parent name, email, phone, or child name..." value={search}
          onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={32} className="text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 font-medium">No parent contacts found</p>
          <p className="text-stone-400 text-sm mt-1">Parent information is added when registering participants.</p>
        </div>
      ) : (
        <div className="card overflow-hidden px-0 sm:px-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="w-12 py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedParents.size === filtered.length && filtered.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedParents(new Set(filtered.map(p => p.id)))
                        } else {
                          setSelectedParents(new Set())
                        }
                      }}
                      className="rounded border-stone-300 text-forest-600 focus:ring-forest-500"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-display font-semibold text-forest-950 text-sm">Parent Name</th>
                  <th className="text-left py-3 px-4 font-display font-semibold text-forest-950 text-sm">Email</th>
                  <th className="text-left py-3 px-4 font-display font-semibold text-forest-950 text-sm">Phone</th>
                  <th className="text-left py-3 px-4 font-display font-semibold text-forest-950 text-sm">Child</th>
                  <th className="text-left py-3 px-4 font-display font-semibold text-forest-950 text-sm">Pronouns</th>
                  <th className="text-left py-3 px-4 font-display font-semibold text-forest-950 text-sm">Approved Adults</th>
                  <th className="text-left py-3 px-4 font-display font-semibold text-forest-950 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const adults = parseApprovedAdults(p.approvedAdults)
                  const isSelected = selectedParents.has(p.id)
                  return (
                    <Fragment key={p.id}>
                      <tr className={`border-b border-stone-100 hover:bg-stone-50 transition-colors ${isSelected ? 'bg-forest-50' : ''}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleParentSelection(p.id)}
                          className="rounded border-stone-300 text-forest-600 focus:ring-forest-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-forest-950">
                        {p.parentName || <span className="bg-red-100 text-red-700 px-1 rounded">Missing</span>}
                      </td>
                      <td className={`py-3 px-4 text-sm text-stone-700 ${!p.parentEmail ? 'bg-red-100 text-red-700' : ''}`}> 
                        {p.parentEmail ? (
                          <a
                            href={`mailto:?bcc=${encodeURIComponent(p.parentEmail)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-forest-600 hover:text-forest-800 hover:underline"
                          >
                            {p.parentEmail}
                          </a>
                        ) : 'Missing'}
                      </td>
                      <td className={`py-3 px-4 text-sm text-stone-700 ${!p.parentPhone ? 'bg-red-100 text-red-700' : ''}`}> 
                        {p.parentPhone ? (
                          <a href={`tel:${p.parentPhone}`} className="text-forest-600 hover:text-forest-800 hover:underline">
                            {p.parentPhone}
                          </a>
                        ) : 'Missing'}
                      </td>
                      <td className="py-3 px-4 text-sm text-stone-700">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-forest-900 flex items-center justify-center text-white font-display font-bold text-xs">
                            {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          {p.name}
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-sm text-stone-700 ${!p.pronouns ? 'bg-red-100 text-red-700' : ''}`}> 
                        {p.pronouns ? p.pronouns : 'Missing'}
                      </td>
                      <td className={`py-3 px-4 text-sm text-stone-700 ${adults.length === 0 ? 'bg-red-100 text-red-700' : ''}`}> 
                        {adults.length > 0 ? (
                          <div className="space-y-1">
                            {adults.map((adult, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <span className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600">
                                  {i + 1}
                                </span>
                                {adult}
                              </div>
                            ))}
                          </div>
                        ) : 'Missing'}
                      </td>
                      <td className="py-3 px-4 text-sm text-stone-700">
                        <button type="button" onClick={() => startEditing(p)}
                          className="btn-secondary text-xs px-3 py-1.5">
                          {adults.length > 0 ? 'Edit' : 'Add'}
                        </button>
                      </td>
                    </tr>
                    {editingId === p.id && (
                      <tr className="bg-stone-50">
                        <td colSpan="7" className="px-4 py-3">
                          <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                              <div>
                                <label className="label">Parent/Guardian Name</label>
                                <input
                                  className="input"
                                  value={p.parentName || ''}
                                  onChange={e => onUpdateParticipant(p.id, { parentName: e.target.value })}
                                  placeholder="Parent name"
                                />
                              </div>
                              <div>
                                <label className="label">Parent/Guardian Email</label>
                                <input
                                  className="input"
                                  type="email"
                                  value={p.parentEmail || ''}
                                  onChange={e => onUpdateParticipant(p.id, { parentEmail: e.target.value })}
                                  placeholder="parent@email.com"
                                />
                              </div>
                              <div>
                                <label className="label">Parent/Guardian Phone</label>
                                <input
                                  className="input"
                                  type="tel"
                                  value={p.parentPhone || ''}
                                  onChange={e => onUpdateParticipant(p.id, { parentPhone: e.target.value })}
                                  placeholder="+44 7700 000000"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 flex-col sm:flex-row items-stretch">
                              <input
                                className="input flex-1"
                                value={newAdult}
                                onChange={e => setNewAdult(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAdult() } }}
                                placeholder="Name (Relationship)"
                              />
                              <button type="button" onClick={addAdult} className="btn-secondary w-full sm:w-auto">Add</button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {editingAdults.length === 0 ? (
                                <span className="text-sm text-stone-500">No approved adults yet.</span>
                              ) : editingAdults.map((adult, i) => (
                                <span key={`${adult}-${i}`} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-sm text-stone-700">
                                  {adult}
                                  <button type="button" onClick={() => removeAdult(i)} className="text-stone-500 hover:text-red-600">×</button>
                                </span>
                              ))}
                            </div>
                            <div className="mt-4 flex gap-2 flex-wrap">
                              <button type="button" onClick={() => saveAdults(p)} className="btn-primary">Save</button>
                              <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}