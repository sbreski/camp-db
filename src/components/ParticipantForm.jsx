import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'

const EMPTY = {
  name: '', pronouns: '', age: '', role: '',
  parentName: '', parentEmail: '', parentPhone: '',
  approvedAdults: '',
  medicalType: [], medicalDetails: '',
  sendNeeds: '', sendDiagnosed: false,
  castPart: '', dressingRoom: '',
  notes: '',
}

export default function ParticipantForm({ onSave, onCancel, initial = EMPTY }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial })

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleMedType(type) {
    set('medicalType', form.medicalType.includes(type)
      ? form.medicalType.filter(t => t !== type)
      : [...form.medicalType, type]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <div className="card border-2 border-forest-200 fade-in">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-bold text-forest-950 text-lg">
          {initial.id ? 'Edit Participant' : 'New Participant'}
        </h3>
        <button onClick={onCancel} className="p-1 text-stone-400 hover:text-stone-600">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <section>
          <h4 className="font-display font-semibold text-sm text-forest-700 mb-3 pb-1 border-b border-stone-100">
            Basic Information
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="First Last" />
            </div>
            <div>
              <label className="label">Pronouns</label>
              <input className="input" value={form.pronouns} onChange={e => set('pronouns', e.target.value)} placeholder="she/her" />
            </div>
            <div>
              <label className="label">Age</label>
              <input className="input" type="number" min="1" max="25" value={form.age} onChange={e => set('age', e.target.value)} placeholder="10" />
            </div>
            <div>
              <label className="label">Role / Part</label>
              <input className="input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="e.g. Dorothy, Ensemble" />
            </div>
            <div>
              <label className="label">Dressing Room</label>
              <input className="input" value={form.dressingRoom} onChange={e => set('dressingRoom', e.target.value)} placeholder="Room 1" />
            </div>
          </div>
        </section>

        {/* Contacts */}
        <section>
          <h4 className="font-display font-semibold text-sm text-forest-700 mb-3 pb-1 border-b border-stone-100">
            Parent / Guardian Contact
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Name</label>
              <input className="input" value={form.parentName} onChange={e => set('parentName', e.target.value)} placeholder="Parent name" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" type="tel" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} placeholder="+44 7700 000000" />
            </div>
            <div className="col-span-2">
              <label className="label">Email</label>
              <input className="input" type="email" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} placeholder="parent@email.com" />
            </div>
            <div className="col-span-2">
              <label className="label">Approved Adults for Collection (comma separated)</label>
              <textarea className="input resize-none" rows={2} value={form.approvedAdults} onChange={e => set('approvedAdults', e.target.value)} placeholder="Name (Relationship), Name (Relationship)" />
            </div>
          </div>
        </section>

        {/* Medical */}
        <section>
          <h4 className="font-display font-semibold text-sm text-forest-700 mb-3 pb-1 border-b border-stone-100">
            Medical / Dietary
          </h4>
          <div className="space-y-3">
            <div>
              <label className="label">Type (select all that apply)</label>
              <div className="flex gap-2 flex-wrap">
                {['Allergy', 'Medical', 'Dietary'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleMedType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      form.medicalType.includes(type)
                        ? type === 'Allergy' ? 'bg-red-600 text-white border-red-600'
                          : type === 'Medical' ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Details</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={form.medicalDetails}
                onChange={e => set('medicalDetails', e.target.value)}
                placeholder="Describe allergies, conditions, medications, dietary requirements..."
              />
            </div>
          </div>
        </section>

        {/* SEND */}
        <section>
          <h4 className="font-display font-semibold text-sm text-forest-700 mb-3 pb-1 border-b border-stone-100">
            SEND / Support Needs
          </h4>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sendDiagnosed"
                checked={form.sendDiagnosed}
                onChange={e => set('sendDiagnosed', e.target.checked)}
                className="rounded"
              />
              <label htmlFor="sendDiagnosed" className="text-sm text-stone-700 font-body">Formally diagnosed</label>
            </div>
            <div>
              <label className="label">Support Needs Details</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={form.sendNeeds}
                onChange={e => set('sendNeeds', e.target.value)}
                placeholder="Describe any SEND needs, support strategies, things staff should know..."
              />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section>
          <h4 className="font-display font-semibold text-sm text-forest-700 mb-3 pb-1 border-b border-stone-100">
            Additional Notes
          </h4>
          <textarea
            className="input resize-none"
            rows={2}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any other relevant information..."
          />
        </section>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1">
            {initial.id ? 'Save Changes' : 'Add Participant'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
