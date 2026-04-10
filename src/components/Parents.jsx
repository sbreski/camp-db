import { useState } from 'react'
import { Users, Search, Mail } from 'lucide-react'

function parseApprovedAdults(str) {
  if (!str) return []
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

export default function Parents({ participants }) {
  const [search, setSearch] = useState('')
  const [selectedParents, setSelectedParents] = useState(new Set())

  function toggleParentSelection(parentId) {
    const newSelected = new Set(selectedParents)
    if (newSelected.has(parentId)) {
      newSelected.delete(parentId)
    } else {
      newSelected.add(parentId)
    }
    setSelectedParents(newSelected)
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
    .filter(p => p.parentName || p.parentEmail || p.parentPhone)
    .filter(p => {
      const query = search.toLowerCase()
      return !query ||
        p.parentName?.toLowerCase().includes(query) ||
        p.parentEmail?.toLowerCase().includes(query) ||
        p.parentPhone?.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query)
    })
    .sort((a, b) => (a.parentName || '').localeCompare(b.parentName || ''))

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Parents & Guardians</h2>
          <p className="text-stone-500 text-sm">{filtered.length} parent contacts</p>
        </div>
        {selectedParents.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-stone-600">{selectedParents.size} selected</span>
            <button onClick={emailSelectedParents} className="btn-primary flex items-center gap-2">
              <Mail size={14} /> Email Selected
            </button>
            <button onClick={clearSelection} className="btn-secondary text-sm">
              Clear
            </button>
          </div>
        )}
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
        <div className="card overflow-hidden">
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
                  <th className="text-left py-3 px-4 font-display font-semibold text-forest-950 text-sm">Approved Adults</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const adults = parseApprovedAdults(p.approvedAdults)
                  const isSelected = selectedParents.has(p.id)
                  return (
                    <tr key={p.id} className={`border-b border-stone-100 hover:bg-stone-50 transition-colors ${isSelected ? 'bg-forest-50' : ''}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleParentSelection(p.id)}
                          className="rounded border-stone-300 text-forest-600 focus:ring-forest-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-forest-950">
                        {p.parentName || '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-stone-700">
                        {p.parentEmail ? (
                          <a
                            href={`mailto:?bcc=${encodeURIComponent(p.parentEmail)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-forest-600 hover:text-forest-800 hover:underline"
                          >
                            {p.parentEmail}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-stone-700">
                        {p.parentPhone ? (
                          <a href={`tel:${p.parentPhone}`} className="text-forest-600 hover:text-forest-800 hover:underline">
                            {p.parentPhone}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-stone-700">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-forest-900 flex items-center justify-center text-white font-display font-bold text-xs">
                            {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          {p.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-stone-700">
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
                        ) : '—'}
                      </td>
                    </tr>
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