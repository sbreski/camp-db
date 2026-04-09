import { useState } from 'react'
import { X, Upload, CheckCircle } from 'lucide-react'

export default function IncidentForm({ participantId, staffList = [], onSave, onCancel }) {
  const defaultStaff = staffList.find(s => s.name === 'Sam Brenner')?.name
    || staffList[0]?.name
    || 'Sam Brenner'

  const [form, setForm] = useState({
    type: 'Accident',
    staffMember: defaultStaff,
    pdfName: null,
    pdfData: null,
  })

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5MB. For larger files, upgrade to Supabase storage.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      set('pdfName', file.name)
      set('pdfData', ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave(form)
  }

  const staffNames = staffList.length > 0
    ? staffList.map(s => s.name)
    : ['Sam Brenner']

  return (
    <div className="border-2 border-amber-200 bg-amber-50 rounded-xl p-4 mb-4 fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display font-semibold text-forest-950">Log Incident / Accident</h4>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
              <option>Accident</option>
              <option>Incident</option>
              <option>Near Miss</option>
              <option>Medical</option>
              <option>Behavioural</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Staff Member</label>
            <select className="input" value={form.staffMember} onChange={e => set('staffMember', e.target.value)}>
              {staffNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Attach Completed Form (PDF or image)</label>
          <label className={`flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-xl p-3 transition-colors bg-white ${
            form.pdfName ? 'border-green-400 bg-green-50' : 'border-stone-200 hover:border-forest-400'
          }`}>
            {form.pdfName
              ? <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
              : <Upload size={16} className="text-stone-400 flex-shrink-0" />
            }
            <span className={`text-sm truncate ${form.pdfName ? 'text-green-700 font-medium' : 'text-stone-500'}`}>
              {form.pdfName || 'Click to upload scanned form...'}
            </span>
            <input type="file" accept=".pdf,image/*" onChange={handleFile} className="hidden" />
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary flex-1">Save Incident</button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}
