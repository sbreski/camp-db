import { useState } from 'react'
import { Lock, Eye, EyeOff, Plus, Trash2, ChevronRight, Edit2, X, User } from 'lucide-react'
import { STAFF_PASSWORD } from '../App'

function StaffForm({ initial, onSave, onCancel }) {
  const empty = { name: '', role: '', phone: '', email: '', emergencyContact: '', emergencyPhone: '', notes: '' }
  const [form, setForm] = useState({ ...empty, ...initial })
  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }
  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }
  return (
    <div className="card border-2 border-forest-200 fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-forest-950">{initial?.id ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="First Last" />
          </div>
          <div>
            <label className="label">Role</label>
            <input className="input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Coordinator, Assistant" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 7700 000000" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="staff@email.com" />
          </div>
          <div>
            <label className="label">Emergency Contact Name</label>
            <input className="input" value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} placeholder="Name (Relationship)" />
          </div>
          <div>
            <label className="label">Emergency Contact Phone</label>
            <input className="input" type="tel" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} placeholder="+44 7700 000000" />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional information..." />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1">{initial?.id ? 'Save Changes' : 'Add Staff Member'}</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}

function StaffDetail({ member, onEdit, onClose }) {
  return (
    <div className="card fade-in">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-forest-900 flex items-center justify-center text-white font-display font-bold text-lg">
            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-display font-bold text-forest-950 text-lg">{member.name}</h3>
            {member.role && <p className="text-sm text-stone-500">{member.role}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="btn-secondary flex items-center gap-1.5 text-xs py-1.5"><Edit2 size={13} /> Edit</button>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1"><X size={18} /></button>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        {member.phone && <p className="flex items-center gap-2 text-forest-700"><span className="text-stone-500 w-28 flex-shrink-0">Phone</span>{member.phone}</p>}
        {member.email && <p className="flex items-center gap-2 text-forest-700"><span className="text-stone-500 w-28 flex-shrink-0">Email</span>{member.email}</p>}
        {member.emergencyContact && (
          <p className="flex items-center gap-2 text-stone-700"><span className="text-stone-500 w-28 flex-shrink-0">Emergency</span>{member.emergencyContact}</p>
        )}
        {member.emergencyPhone && (
          <p className="flex items-center gap-2 text-forest-700"><span className="text-stone-500 w-28 flex-shrink-0">Emerg. Phone</span>{member.emergencyPhone}</p>
        )}
        {member.notes && (
          <div className="mt-3 pt-3 border-t border-stone-100">
            <p className="label mb-1">Notes</p>
            <p className="text-stone-700 leading-relaxed">{member.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Staff({ staffList, setStaffList }) {
  const [authed, setAuthed] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwError, setPwError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)

  function submitPassword(e) {
    e.preventDefault()
    if (pwInput === STAFF_PASSWORD) { setAuthed(true) }
    else { setPwError(true); setPwInput('') }
  }

  function addStaff(data) {
    setStaffList(prev => [...prev, { ...data, id: crypto.randomUUID() }])
    setShowForm(false)
  }

  function saveEdit(data) {
    setStaffList(prev => prev.map(s => s.id === selected.id ? { ...s, ...data } : s))
    setSelected(s => ({ ...s, ...data }))
    setEditing(false)
  }

  function deleteStaff(id) {
    if (!window.confirm('Remove this staff member?')) return
    setStaffList(prev => prev.filter(s => s.id !== id))
    setSelected(null)
  }

  if (!authed) {
    return (
      <div className="fade-in max-w-sm mx-auto mt-12">
        <div className="card text-center">
          <div className="w-14 h-14 bg-forest-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-amber-400" />
          </div>
          <h2 className="font-display font-bold text-forest-950 text-xl mb-1">Staff Records</h2>
          <p className="text-stone-500 text-sm mb-6">This section requires a separate password.</p>
          <form onSubmit={submitPassword} className="space-y-3 text-left">
            <div>
              <label className="label">Staff Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={pwInput}
                  onChange={e => { setPwInput(e.target.value); setPwError(false) }}
                  className={`input pr-10 ${pwError ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                  placeholder="Enter staff password" autoFocus />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwError && <p className="text-red-600 text-xs mt-1.5 font-medium">Incorrect password.</p>}
            </div>
            <button type="submit" className="btn-primary w-full">Unlock</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-forest-950">Staff</h2>
          <p className="text-stone-500 text-sm">{staffList.length} staff members</p>
        </div>
        <button onClick={() => { setShowForm(true); setSelected(null) }} className="btn-primary flex items-center gap-2">
          <Plus size={15} strokeWidth={2.5} /> Add Staff
        </button>
      </div>

      {showForm && (
        <StaffForm onSave={addStaff} onCancel={() => setShowForm(false)} />
      )}

      {selected && !editing && (
        <StaffDetail
          member={selected}
          onEdit={() => setEditing(true)}
          onClose={() => setSelected(null)}
        />
      )}

      {selected && editing && (
        <StaffForm initial={selected} onSave={saveEdit} onCancel={() => setEditing(false)} />
      )}

      <div className="space-y-2">
        {staffList.length === 0 ? (
          <div className="card text-center py-10">
            <User size={32} className="text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500">No staff added yet.</p>
          </div>
        ) : (
          staffList.map(s => (
            <div key={s.id}
              className={`card flex items-center gap-4 hover:shadow-sm transition-shadow group cursor-pointer ${selected?.id === s.id ? 'ring-2 ring-forest-400' : ''}`}
              onClick={() => { setSelected(s); setEditing(false); setShowForm(false) }}>
              <div className="w-10 h-10 rounded-full bg-forest-900 flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0">
                {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-forest-950 group-hover:text-forest-700">{s.name}</p>
                <p className="text-xs text-stone-400 truncate">{s.role || 'Staff'}{s.phone ? ` · ${s.phone}` : ''}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteStaff(s.id) }}
                className="p-1.5 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 size={15} />
              </button>
              <ChevronRight size={18} className="text-stone-400 group-hover:text-forest-700" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
