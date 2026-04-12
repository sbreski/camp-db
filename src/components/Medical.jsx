import { Download, Pill, Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ParticipantNameText from './ParticipantNameText'
import { supabase } from '../supabase'

const ALLERGEN_OPTIONS = [
  'Milk',
  'Egg',
  'Peanut',
  'Tree Nut',
  'Sesame',
  'Soy',
  'Gluten',
  'Shellfish',
]

function nowLocalDateTimeValue() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes(String(columnName || '').toLowerCase()) && message.includes('does not exist')
}

export default function Medical({ participants, setParticipants, actorInitials = 'ST', onView }) {
  const [selectedFilters, setSelectedFilters] = useState([])
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState('overview')
  const [loadingOps, setLoadingOps] = useState(false)
  const [savingMar, setSavingMar] = useState(false)
  const [uploadingForm, setUploadingForm] = useState(false)

  const [medicationPlans, setMedicationPlans] = useState([])
  const [medicationAdministration, setMedicationAdministration] = useState([])
  const [medicationForms, setMedicationForms] = useState([])

  const [selectedMatrixParticipantId, setSelectedMatrixParticipantId] = useState('')
  const [allergenDraft, setAllergenDraft] = useState({})
  const [mealSafeTagsDraft, setMealSafeTagsDraft] = useState('')
  const [mealAdjustmentsDraft, setMealAdjustmentsDraft] = useState('')

  const [formParticipantId, setFormParticipantId] = useState('')
  const [formType, setFormType] = useState('Daily Medication Form')
  const [formValidUntil, setFormValidUntil] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formFile, setFormFile] = useState(null)

  const [marDraft, setMarDraft] = useState(() => ({
    participantId: '',
    medicationPlanId: '',
    medicationName: '',
    doseGiven: '',
    administeredAt: nowLocalDateTimeValue(),
    status: 'given',
    staffInitials: actorInitials,
    parentNotified: false,
    parentNotifiedAt: '',
    parentNotificationMethod: '',
    parentNotificationNotes: '',
    notes: '',
  }))

  useEffect(() => {
    if (!selectedMatrixParticipantId && participants.length > 0) {
      setSelectedMatrixParticipantId(participants[0].id)
    }
    if (!formParticipantId && participants.length > 0) {
      setFormParticipantId(participants[0].id)
    }
    if (!marDraft.participantId && participants.length > 0) {
      setMarDraft(prev => ({ ...prev, participantId: participants[0].id }))
    }
  }, [participants, selectedMatrixParticipantId, formParticipantId, marDraft.participantId])

  useEffect(() => {
    loadMedicalOperations()
  }, [])

  useEffect(() => {
    const participant = participants.find(p => p.id === selectedMatrixParticipantId)
    if (!participant) return
    setAllergenDraft(participant.allergenMatrix || participant.allergen_matrix || {})
    setMealSafeTagsDraft((participant.mealSafeTags || participant.meal_safe_tags || []).join(', '))
    setMealAdjustmentsDraft(participant.mealAdjustments || participant.meal_adjustments || '')
  }, [participants, selectedMatrixParticipantId])

  async function loadMedicalOperations() {
    setLoadingOps(true)
    try {
      const [plansRes, adminRes, formsRes] = await Promise.all([
        supabase.from('medication_plans').select('*').order('created_at', { ascending: false }),
        supabase.from('medication_administration').select('*').order('administered_at', { ascending: false }),
        supabase.from('medication_forms').select('*').order('created_at', { ascending: false }),
      ])

      if (!plansRes.error) setMedicationPlans(plansRes.data || [])
      if (!adminRes.error) setMedicationAdministration(adminRes.data || [])
      if (!formsRes.error) setMedicationForms(formsRes.data || [])
    } catch (error) {
      console.error('MEDICAL OPS LOAD ERROR:', error)
    } finally {
      setLoadingOps(false)
    }
  }

  function matchesMedicalFilter(participant, filter) {
    if (filter === 'SEND') return !!participant.sendNeeds
    if (filter === 'Allergy') return participant.medicalType?.includes('Allergy')
    if (filter === 'Dietary') return participant.medicalType?.includes('Dietary')
    return participant.medicalType?.includes(filter)
  }

  const medParticipants = participants.filter(p =>
    (p.medicalType?.length > 0 || p.sendNeeds) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const filtered = selectedFilters.length === 0
    ? medParticipants
    : medParticipants.filter(p => selectedFilters.some(filter => matchesMedicalFilter(p, filter)))

  const counts = {
    All: participants.filter(p => p.medicalType?.length > 0 || p.sendNeeds).length,
    Allergy: participants.filter(p => p.medicalType?.includes('Allergy')).length,
    Dietary: participants.filter(p => p.medicalType?.includes('Dietary')).length,
    Medical: participants.filter(p => p.medicalType?.includes('Medical')).length,
    SEND: participants.filter(p => p.sendNeeds).length,
  }

  function toggleFilter(filter) {
    setSelectedFilters(prev => prev.includes(filter)
      ? prev.filter(f => f !== filter)
      : [...prev, filter])
  }

  const participantsById = useMemo(() => {
    const map = new Map()
    for (const participant of participants) map.set(participant.id, participant)
    return map
  }, [participants])

  const plansByParticipant = useMemo(() => {
    const byParticipant = new Map()
    for (const plan of medicationPlans) {
      const key = plan.participant_id
      if (!key) continue
      const list = byParticipant.get(key) || []
      list.push(plan)
      byParticipant.set(key, list)
    }
    return byParticipant
  }, [medicationPlans])

  const filteredForms = useMemo(() => {
    if (!formParticipantId) return medicationForms
    return medicationForms.filter(form => form.participant_id === formParticipantId)
  }, [medicationForms, formParticipantId])

  const marRows = useMemo(() => {
    return medicationAdministration.slice(0, 100)
  }, [medicationAdministration])

  function updateMarDraft(key, value) {
    setMarDraft(prev => ({ ...prev, [key]: value }))
  }

  async function saveMarEntry(e) {
    e.preventDefault()
    if (!marDraft.participantId) {
      alert('Choose a participant.')
      return
    }
    if (!marDraft.administeredAt) {
      alert('Choose administration date and time.')
      return
    }
    if (!marDraft.staffInitials.trim()) {
      alert('Staff initials are required.')
      return
    }

    const selectedPlan = medicationPlans.find(plan => plan.id === marDraft.medicationPlanId)
    const payload = {
      id: crypto.randomUUID(),
      participant_id: marDraft.participantId,
      medication_plan_id: marDraft.medicationPlanId || null,
      administered_at: new Date(marDraft.administeredAt).toISOString(),
      status: marDraft.status,
      staff_initials: marDraft.staffInitials.trim().toUpperCase(),
      notes: marDraft.notes.trim() || null,
      dose_given: marDraft.doseGiven.trim() || null,
      medication_name: marDraft.medicationName.trim() || selectedPlan?.medication_name || null,
      parent_notified: Boolean(marDraft.parentNotified),
      parent_notified_at: marDraft.parentNotified && marDraft.parentNotifiedAt
        ? new Date(marDraft.parentNotifiedAt).toISOString()
        : null,
      parent_notification_method: marDraft.parentNotified
        ? (marDraft.parentNotificationMethod.trim() || null)
        : null,
      parent_notification_notes: marDraft.parentNotified
        ? (marDraft.parentNotificationNotes.trim() || null)
        : null,
    }

    setSavingMar(true)
    try {
      let { error } = await supabase.from('medication_administration').insert(payload)
      if (error && isMissingColumnError(error, 'parent_notified')) {
        const {
          dose_given,
          medication_name,
          parent_notified,
          parent_notified_at,
          parent_notification_method,
          parent_notification_notes,
          ...fallbackPayload
        } = payload
        const fallback = await supabase.from('medication_administration').insert(fallbackPayload)
        error = fallback.error
      }
      if (error) throw error

      await loadMedicalOperations()
      setMarDraft(prev => ({
        ...prev,
        medicationPlanId: '',
        medicationName: '',
        doseGiven: '',
        administeredAt: nowLocalDateTimeValue(),
        status: 'given',
        parentNotified: false,
        parentNotifiedAt: '',
        parentNotificationMethod: '',
        parentNotificationNotes: '',
        notes: '',
      }))
    } catch (error) {
      alert(`Could not save MAR entry: ${error.message}`)
    } finally {
      setSavingMar(false)
    }
  }

  async function saveMealMatrix() {
    if (!selectedMatrixParticipantId) return
    const tags = mealSafeTagsDraft
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)

    try {
      await setParticipants(prev => prev.map(participant => {
        if (participant.id !== selectedMatrixParticipantId) return participant
        return {
          ...participant,
          allergenMatrix: allergenDraft,
          mealSafeTags: tags,
          mealAdjustments: mealAdjustmentsDraft,
        }
      }))
      alert('Meal matrix saved.')
    } catch (error) {
      alert(`Could not save meal matrix: ${error.message}`)
    }
  }

  function toggleAllergen(option) {
    const key = normalizeText(option)
    setAllergenDraft(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  async function uploadMedicationForm() {
    if (!formParticipantId) {
      alert('Choose a participant.')
      return
    }
    if (!formFile) {
      alert('Choose a PDF form to upload.')
      return
    }
    if (!formFile.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF uploads are supported.')
      return
    }

    setUploadingForm(true)
    try {
      const stampedName = `${Date.now()}-${formFile.name}`
      const storagePath = `medical-forms/${formParticipantId}/${stampedName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, formFile)
      if (uploadError) throw uploadError

      const payload = {
        id: crypto.randomUUID(),
        participant_id: formParticipantId,
        medication_plan_id: null,
        form_name: `${formType}: ${formFile.name}`,
        storage_path: storagePath,
        uploaded_by_initials: actorInitials,
        valid_until: formValidUntil || null,
        notes: formNotes.trim() || null,
      }

      let { error: insertError } = await supabase.from('medication_forms').insert(payload)
      if (insertError && isMissingColumnError(insertError, 'uploaded_by_initials')) {
        const { uploaded_by_initials, ...fallbackPayload } = payload
        const fallback = await supabase.from('medication_forms').insert(fallbackPayload)
        insertError = fallback.error
      }
      if (insertError) throw insertError

      await loadMedicalOperations()
      setFormFile(null)
      setFormType('Daily Medication Form')
      setFormValidUntil('')
      setFormNotes('')
      alert('Medical form uploaded.')
    } catch (error) {
      alert(`Could not upload medical form: ${error.message}`)
    } finally {
      setUploadingForm(false)
    }
  }

  async function downloadMedicationForm(form) {
    try {
      const { data, error } = await supabase.storage.from('documents').download(form.storage_path)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) {
        URL.revokeObjectURL(url)
        throw new Error('Popup blocked. Please allow popups for this site.')
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      alert(`Could not download form: ${error.message}`)
    }
  }

  async function deleteMedicationForm(form) {
    if (!window.confirm('Delete this medical form?')) return
    try {
      await supabase.storage.from('documents').remove([form.storage_path])
      await supabase.from('medication_forms').delete().eq('id', form.id)
      await loadMedicalOperations()
    } catch (error) {
      alert(`Could not delete form: ${error.message}`)
    }
  }

  function esc(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function printMedicalReport(filters = selectedFilters) {
    const list = filters.length === 0
      ? medParticipants
      : medParticipants.filter(p => filters.some(filter => matchesMedicalFilter(p, filter)))

    const title = filters.length === 0
      ? 'Medical and Support Record (All flagged participants)'
      : `Medical and Support Record (${filters.join(', ')})`

    const rows = list.map(p => {
      const badges = [
        ...(p.medicalType || []),
        ...(p.sendNeeds ? ['SEND'] : []),
      ].join(', ')
      return `
        <tr>
          <td>${esc(p.sendDiagnosed ? `${p.name} *` : p.name)}</td>
          <td>${esc([p.pronouns, p.age ? `Age ${p.age}` : ''].filter(Boolean).join(' · '))}</td>
          <td>${esc(badges || '—')}</td>
          <td>${esc(p.medicalDetails || '—')}</td>
          <td>${esc(p.sendNeeds || '—')}</td>
        </tr>
      `
    }).join('')

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${esc(title)}</title>
          <style>
            body { font-family: Georgia, serif; margin: 24px; color: #1f2937; }
            h1 { font-size: 20px; margin: 0 0 6px; }
            .meta { color: #6b7280; font-size: 12px; margin-bottom: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>${esc(title)}</h1>
          <div class="meta">Generated: ${new Date().toLocaleString('en-GB')}</div>
          <table>
            <thead>
              <tr>
                <th>Participant</th>
                <th>Details</th>
                <th>Flags</th>
                <th>Medical Notes</th>
                <th>SEND Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5">No participants in this filter.</td></tr>'}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `

    const win = window.open('', '_blank', 'width=1100,height=800')
    if (!win) {
      alert('Allow pop-ups to print this report.')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  return (
    <div className="fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-display font-bold text-forest-950">Medical & Support</h2>
        <p className="text-stone-500 text-sm">{counts.All} participants with flagged needs</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'overview', label: 'Needs Overview' },
          { id: 'mar', label: 'Medication Administration (MAR)' },
          { id: 'forms', label: 'Medical Forms' },
          { id: 'meal', label: 'Dietary & Allergy Matrix' },
        ].map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-display font-medium transition-all ${
              activeSection === section.id
                ? 'bg-forest-900 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'mar' && (
        <div className="space-y-4">
          <form onSubmit={saveMarEntry} className="card space-y-3">
            <h3 className="font-display font-semibold text-forest-950 flex items-center gap-2">
              <Pill size={16} /> Add MAR Entry
            </h3>
            <p className="text-xs text-stone-500">Parent notification is manual only. Record it when it happens.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Participant *</label>
                <select className="input" value={marDraft.participantId} onChange={e => updateMarDraft('participantId', e.target.value)} required>
                  {participants.map(participant => (
                    <option key={participant.id} value={participant.id}>{participant.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Medication Plan</label>
                <select className="input" value={marDraft.medicationPlanId} onChange={e => updateMarDraft('medicationPlanId', e.target.value)}>
                  <option value="">None / ad-hoc</option>
                  {(plansByParticipant.get(marDraft.participantId) || []).map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.medication_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Dose Given</label>
                <input className="input" value={marDraft.doseGiven} onChange={e => updateMarDraft('doseGiven', e.target.value)} placeholder="e.g. 5ml / 1 tablet" />
              </div>
              <div>
                <label className="label">Medication Name</label>
                <input className="input" value={marDraft.medicationName} onChange={e => updateMarDraft('medicationName', e.target.value)} placeholder="Required if no plan selected" />
              </div>
              <div>
                <label className="label">Administered At *</label>
                <input type="datetime-local" className="input" value={marDraft.administeredAt} onChange={e => updateMarDraft('administeredAt', e.target.value)} required />
              </div>
              <div>
                <label className="label">Status *</label>
                <select className="input" value={marDraft.status} onChange={e => updateMarDraft('status', e.target.value)}>
                  <option value="given">Given</option>
                  <option value="refused">Refused</option>
                  <option value="missed">Missed dose</option>
                  <option value="withheld">Withheld</option>
                </select>
              </div>
              <div>
                <label className="label">Staff Initials *</label>
                <input className="input" value={marDraft.staffInitials} onChange={e => updateMarDraft('staffInitials', e.target.value)} maxLength={4} required />
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={marDraft.notes} onChange={e => updateMarDraft('notes', e.target.value)} placeholder="Context / observations" />
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 p-3 space-y-3">
              <label className="inline-flex items-center gap-2 text-sm text-forest-900">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={marDraft.parentNotified}
                  onChange={e => updateMarDraft('parentNotified', e.target.checked)}
                />
                Parent notified (manual log)
              </label>
              {marDraft.parentNotified && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Notified At</label>
                    <input type="datetime-local" className="input" value={marDraft.parentNotifiedAt} onChange={e => updateMarDraft('parentNotifiedAt', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Method</label>
                    <input className="input" value={marDraft.parentNotificationMethod} onChange={e => updateMarDraft('parentNotificationMethod', e.target.value)} placeholder="Phone / in-person / email" />
                  </div>
                  <div>
                    <label className="label">Notification Notes</label>
                    <input className="input" value={marDraft.parentNotificationNotes} onChange={e => updateMarDraft('parentNotificationNotes', e.target.value)} placeholder="Who was informed / outcome" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <button className="btn-primary" type="submit" disabled={savingMar}>{savingMar ? 'Saving...' : 'Save MAR Entry'}</button>
            </div>
          </form>

          <div className="card">
            <h3 className="font-display font-semibold text-forest-950 mb-3">Recent MAR Log</h3>
            {loadingOps ? (
              <p className="text-sm text-stone-500">Loading MAR...</p>
            ) : marRows.length === 0 ? (
              <p className="text-sm text-stone-500">No MAR entries logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wide border-b border-stone-100">
                      <th className="pb-2 pr-3">Time</th>
                      <th className="pb-2 pr-3">Participant</th>
                      <th className="pb-2 pr-3">Medication</th>
                      <th className="pb-2 pr-3">Dose</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2 pr-3">Initials</th>
                      <th className="pb-2">Parent Notified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {marRows.map(row => {
                      const participantName = participantsById.get(row.participant_id)?.name || 'Unknown'
                      const when = row.administered_at ? new Date(row.administered_at).toLocaleString('en-GB') : '—'
                      const notified = row.parent_notified ? 'Yes' : 'No'
                      return (
                        <tr key={row.id}>
                          <td className="py-2 pr-3 whitespace-nowrap">{when}</td>
                          <td className="py-2 pr-3">{participantName}</td>
                          <td className="py-2 pr-3">{row.medication_name || medicationPlans.find(p => p.id === row.medication_plan_id)?.medication_name || '—'}</td>
                          <td className="py-2 pr-3">{row.dose_given || '—'}</td>
                          <td className="py-2 pr-3 capitalize">{row.status}</td>
                          <td className="py-2 pr-3">{row.staff_initials}</td>
                          <td className="py-2">{notified}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'forms' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-display font-semibold text-forest-950">Medical Forms (Upload to Child File)</h3>
            <p className="text-xs text-stone-500">Use this for daily medication forms, allergy plans, and medical plans.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Participant *</label>
                <select className="input" value={formParticipantId} onChange={e => setFormParticipantId(e.target.value)}>
                  {participants.map(participant => (
                    <option key={participant.id} value={participant.id}>{participant.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Form Type *</label>
                <select className="input" value={formType} onChange={e => setFormType(e.target.value)}>
                  <option>Daily Medication Form</option>
                  <option>Allergy Plan</option>
                  <option>Medical Plan</option>
                  <option>Other Medical Form</option>
                </select>
              </div>
              <div>
                <label className="label">Valid Until</label>
                <input type="date" className="input" value={formValidUntil} onChange={e => setFormValidUntil(e.target.value)} />
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Optional notes" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">PDF File *</label>
                <input type="file" accept="application/pdf" onChange={e => setFormFile(e.target.files?.[0] || null)} className="input" />
              </div>
            </div>
            <button onClick={uploadMedicationForm} className="btn-primary inline-flex items-center gap-2" disabled={uploadingForm}>
              <Upload size={14} /> {uploadingForm ? 'Uploading...' : 'Upload Form'}
            </button>
          </div>

          <div className="card">
            <h3 className="font-display font-semibold text-forest-950 mb-3">Uploaded Forms</h3>
            {loadingOps ? (
              <p className="text-sm text-stone-500">Loading forms...</p>
            ) : filteredForms.length === 0 ? (
              <p className="text-sm text-stone-500">No forms uploaded for this participant yet.</p>
            ) : (
              <div className="space-y-2">
                {filteredForms.map(form => (
                  <div key={form.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-forest-950">{form.form_name}</p>
                      <p className="text-xs text-stone-500">
                        Uploaded {new Date(form.created_at).toLocaleDateString('en-GB')}
                        {form.valid_until ? ` · Valid until ${new Date(`${form.valid_until}T12:00:00`).toLocaleDateString('en-GB')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => downloadMedicationForm(form)} className="btn-secondary text-xs inline-flex items-center gap-1">
                        <Download size={12} /> Download
                      </button>
                      <button onClick={() => deleteMedicationForm(form)} className="btn-secondary text-xs text-rose-700 border-rose-200 hover:bg-rose-50">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'meal' && (
        <div className="card space-y-4">
          <h3 className="font-display font-semibold text-forest-950">Dietary & Allergy Meal Matrix</h3>
          <p className="text-xs text-stone-500">Per-child allergen matrix and meal-safe tags for kitchen/serving teams.</p>

          <div>
            <label className="label">Participant</label>
            <select className="input" value={selectedMatrixParticipantId} onChange={e => setSelectedMatrixParticipantId(e.target.value)}>
              {participants.map(participant => (
                <option key={participant.id} value={participant.id}>{participant.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Allergen Matrix</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-stone-200 p-3">
              {ALLERGEN_OPTIONS.map(option => {
                const key = normalizeText(option)
                return (
                  <label key={option} className="inline-flex items-center gap-2 text-sm text-forest-900">
                    <input type="checkbox" className="h-4 w-4" checked={Boolean(allergenDraft[key])} onChange={() => toggleAllergen(option)} />
                    {option}
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Meal Safe Tags (comma separated)</label>
            <input
              className="input"
              value={mealSafeTagsDraft}
              onChange={e => setMealSafeTagsDraft(e.target.value)}
              placeholder="e.g. no-nuts, dairy-free, gluten-free"
            />
          </div>

          <div>
            <label className="label">Kitchen / Serving Notes</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={mealAdjustmentsDraft}
              onChange={e => setMealAdjustmentsDraft(e.target.value)}
              placeholder="Serving separation, cross-contamination precautions, substitutions..."
            />
          </div>

          <button onClick={saveMealMatrix} className="btn-primary">Save Meal Matrix</button>
        </div>
      )}

      {activeSection === 'overview' && (
        <>

      <div className="flex gap-2 flex-wrap items-center">
        {Object.entries(counts).filter(([label]) => label !== 'All').map(([label, count]) => (
          <button
            key={label}
            onClick={() => toggleFilter(label)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-display font-medium transition-all ${
              selectedFilters.includes(label)
                ? 'bg-forest-900 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-400'
            }`}
          >
            {label} <span className="ml-1 opacity-70">({count})</span>
          </button>
        ))}
        <button onClick={() => setSelectedFilters([])} className="btn-secondary text-xs py-1.5">
          Clear filters
        </button>
        <button onClick={() => printMedicalReport()} className="btn-primary text-xs py-1.5">
          Print Current View
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['SEND', 'Allergy', 'Dietary', 'Medical'].map(label => (
          <button key={label} onClick={() => printMedicalReport([label])} className="btn-secondary text-xs py-1.5">
            Print {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-stone-400 text-sm">No participants match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div
              key={p.id}
              className="card hover:shadow-sm transition-shadow cursor-pointer group"
              onClick={() => onView(p.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <ParticipantNameText participant={p} className="font-display font-semibold text-forest-950 group-hover:text-forest-700" />
                  <p className="text-xs text-stone-400">{p.pronouns}{p.age ? ` · Age ${p.age}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {p.medicalType?.map(t => (
                    <span key={t} className={
                      t === 'Allergy' ? 'badge-allergy' : t === 'Dietary' ? 'badge-dietary' : t === 'Medical' ? 'badge-medical' : 'badge-dietary'
                    }>{t}</span>
                  ))}
                  {p.sendNeeds && <span className="badge-send">SEND</span>}
                </div>
              </div>
              {(() => {
                const showAll = selectedFilters.length === 0
                const wantsMedical = showAll || selectedFilters.includes('Medical')
                const wantsSend = showAll || selectedFilters.includes('SEND')
                const wantsAllergy = showAll || selectedFilters.includes('Allergy')
                const wantsDietary = showAll || selectedFilters.includes('Dietary')
                const hasAnyShown =
                  (wantsMedical && !!p.medicalDetails) ||
                  (wantsAllergy && !!p.allergyDetails) ||
                  (wantsDietary && !!(p.dietaryType || p.mealAdjustments)) ||
                  (wantsSend && !!p.sendNeeds)

                if (!hasAnyShown) return null

                return (
                  <>
              {wantsMedical && p.medicalDetails && (
                <div className="mt-2 p-3 bg-stone-50 rounded-lg text-sm text-stone-700 leading-relaxed">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Medical Details</p>
                  {p.medicalDetails}
                </div>
              )}
              {wantsAllergy && p.allergyDetails && (
                <div className="mt-2 p-3 bg-red-50 rounded-lg text-sm text-red-900 leading-relaxed">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Allergy Details</p>
                  {p.allergyDetails}
                </div>
              )}
              {wantsDietary && (p.dietaryType || p.mealAdjustments) && (
                <div className="mt-2 p-3 bg-green-50 rounded-lg text-sm text-green-900 leading-relaxed">
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Dietary Details</p>
                  {[p.dietaryType, p.mealAdjustments].filter(Boolean).join(' - ')}
                </div>
              )}
              {wantsSend && p.sendNeeds && (
                <div className="mt-2 p-3 bg-purple-50 rounded-lg text-sm text-purple-900 leading-relaxed">
                  <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">Support Needs</p>
                  {p.sendNeeds}
                </div>
              )}
                  </>
                )
              })()}
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}
