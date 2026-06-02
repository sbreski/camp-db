import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'

const EMPTY = {
  name: '', pronouns: '', age: '',
  birthday: '',
  address: '', postcode: '', schoolAttending: '',
  siblings: false, siblingsName: '',
  parentName: '', parentEmail: '', parentPhone: '',
  parent2Name: '', parent2Email: '', parent2Phone: '',
  homePhone: '',
  approvedAdults: '',
  can_leave_alone: false,
  photoConsent: 'yes', otcConsent: false,
  otcAllowedItems: [], otcNotes: '',
  dietaryType: '', allergyDetails: '', mealAdjustments: '',
  medicalType: [], medicalDetails: '',
  sendNeeds: '', sendDiagnosed: false, sendDiagnosis: '',
  isActiveThisSeason: true,
  notes: '',
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function parseApprovedAdultEntry(entry) {
  const text = String(entry || '').trim()
  if (!text) return { name: '', relationship: '', phone: '' }

  const phoneMatch = text.match(/^(.*?)\s*-\s*(\+?[0-9][0-9\s()\-]{5,})\s*$/)
  const withoutPhone = phoneMatch ? phoneMatch[1].trim() : text
  const phone = phoneMatch ? phoneMatch[2].trim() : ''

  const relationshipMatch = withoutPhone.match(/^(.*?)\s*\((.*?)\)\s*$/)
  if (!relationshipMatch) return { name: withoutPhone, relationship: '', phone }

  return {
    name: (relationshipMatch[1] || '').trim(),
    relationship: (relationshipMatch[2] || '').trim(),
    phone,
  }
}

function formatApprovedAdultEntry(entry) {
  const name = String(entry?.name || '').trim()
  const relationship = String(entry?.relationship || '').trim()
  const phone = String(entry?.phone || '').trim()
  if (!name) return ''

  const nameWithRelationship = relationship ? `${name} (${relationship})` : name
  return phone ? `${nameWithRelationship} - ${phone}` : nameWithRelationship
}

function getParticipantContactKeys(participant) {
  return {
    names: [participant?.parentName, participant?.parent2Name]
      .map(normalizeText)
      .filter(Boolean),
    emails: [participant?.parentEmail, participant?.parent2Email]
      .map(normalizeText)
      .filter(Boolean),
    phones: [participant?.parentPhone, participant?.parent2Phone, participant?.homePhone]
      .map(normalizePhone)
      .filter(Boolean),
  }
}

function contactsMatch(source, target) {
  const sourceKeys = getParticipantContactKeys(source)
  const targetKeys = getParticipantContactKeys(target)

  const sharesName = sourceKeys.names.some(value => targetKeys.names.includes(value))
  const sharesEmail = sourceKeys.emails.some(value => targetKeys.emails.includes(value))
  const sharesPhone = sourceKeys.phones.some(value => targetKeys.phones.includes(value))

  return sharesName || sharesEmail || sharesPhone
}

function getDefaultLinkedParticipantIds(participant, allParticipants) {
  const matches = allParticipants
    .filter(p => {
      if (participant.id === p.id) return true
      return contactsMatch(participant, p)
    })
    .map(p => p.id)

  return matches.length > 0 ? matches : [participant.id]
}

function getLikelySiblingIdsFromContact(contact, allParticipants, fallbackParticipantId) {
  const matches = allParticipants
    .filter(p => contactsMatch(contact, p))
    .map(p => p.id)

  return matches.length > 0 ? matches : [fallbackParticipantId]
}

function normalizeDateInput(value) {
  if (!value) return ''
  const text = String(value).trim()
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]
  return ''
}

export default function ParticipantForm({ onSave, onCancel, initial = EMPTY, participants = [] }) {
  const [form, setForm] = useState({
    ...EMPTY,
    ...initial,
    birthday: normalizeDateInput(initial.birthday || initial.dob),
    siblings: Boolean(initial.siblings),
    photoConsent: initial.photoConsent || 'yes',
    otcConsent: Boolean(initial.otcConsent),
    isActiveThisSeason: (initial.isActiveThisSeason ?? initial.is_active_this_season) !== false,
    can_leave_alone: Boolean(initial.can_leave_alone),
  })
  const [otcAllowedItemsInput, setOtcAllowedItemsInput] = useState(() => {
    if (Array.isArray(initial.otcAllowedItems)) return initial.otcAllowedItems.join(', ')
    if (typeof initial.otcAllowedItems === 'string') return initial.otcAllowedItems
    return ''
  })
  const [approvedAdultsList, setApprovedAdultsList] = useState(() => (
    initial.approvedAdults?.split(',').map(a => a.trim()).filter(Boolean) || []
  ))
  const [newApprovedAdultName, setNewApprovedAdultName] = useState('')
  const [newApprovedAdultRelationship, setNewApprovedAdultRelationship] = useState('')
  const [newApprovedAdultPhone, setNewApprovedAdultPhone] = useState('')
  const [linkedParticipantIds, setLinkedParticipantIds] = useState(() => (
    initial.id ? getDefaultLinkedParticipantIds(initial, participants) : []
  ))

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function addApprovedAdult() {
    const next = formatApprovedAdultEntry({
      name: newApprovedAdultName,
      relationship: newApprovedAdultRelationship,
      phone: newApprovedAdultPhone,
    })
    if (!next) return

    if (!approvedAdultsList.some(a => a.toLowerCase() === next.toLowerCase())) {
      setApprovedAdultsList(prev => [...prev, next])
    }
    setNewApprovedAdultName('')
    setNewApprovedAdultRelationship('')
    setNewApprovedAdultPhone('')
  }

  function removeApprovedAdult(index) {
    setApprovedAdultsList(prev => prev.filter((_, i) => i !== index))
  }

  function stripParentSuffix(name) {
    const parsed = parseApprovedAdultEntry(name)
    const base = String(parsed.name || '').trim()
    return base.replace(/\s*\(parent\)$/i, '').trim()
  }

  function hasSameAdult(list, name) {
    const normalized = stripParentSuffix(name).toLowerCase()
    return list.some(a => stripParentSuffix(a).toLowerCase() === normalized)
  }

  function formatParentLabel(name) {
    const clean = stripParentSuffix(name)
    return clean ? `${clean} (Parent)` : ''
  }

  function toggleMedType(type) {
    set('medicalType', form.medicalType.includes(type)
      ? form.medicalType.filter(t => t !== type)
      : [...form.medicalType, type]
    )
  }

  function toggleLinkedParticipant(participantId) {
    setLinkedParticipantIds(prev => (
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    ))
  }

  function autoSelectLikelySiblings() {
    if (!initial.id) return
    setLinkedParticipantIds(getLikelySiblingIdsFromContact(form, participants, initial.id))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return

    const normalizedAdults = [...approvedAdultsList]
    ;[form.parent2Name, form.parentName].forEach((adultName) => {
      const parentName = String(adultName || '').trim()
      if (parentName) {
        const parentLabel = formatParentLabel(parentName)
        if (!hasSameAdult(normalizedAdults, parentName)) {
          normalizedAdults.unshift(parentLabel)
        }
      }
    })

    const linkedIds = initial.id
      ? (linkedParticipantIds.length > 0 ? linkedParticipantIds : [initial.id])
      : []

    onSave({
      ...form,
      approvedAdults: normalizedAdults.join(', '),
      otcAllowedItems: otcAllowedItemsInput.split(',').map(item => item.trim()).filter(Boolean),
      ...(initial.id ? { _linkedParticipantIds: linkedIds } : {}),
    })
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
              <label className="label">Birthday</label>
              <input className="input" type="date" value={form.birthday || ''} onChange={e => set('birthday', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">School Attending</label>
              <input className="input" value={form.schoolAttending || ''} onChange={e => set('schoolAttending', e.target.value)} placeholder="Primary/secondary school" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Postcode</label>
              <input className="input" value={form.postcode || ''} onChange={e => set('postcode', e.target.value)} placeholder="N1 9QX" />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={form.address || ''}
                onChange={e => set('address', e.target.value)}
                placeholder="Home address"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="inline-flex items-center gap-2 text-sm text-stone-700 mt-1">
                <input
                  type="checkbox"
                  checked={Boolean(form.siblings)}
                  onChange={e => set('siblings', e.target.checked)}
                  className="rounded"
                />
                Has siblings attending
              </label>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Sibling Name(s)</label>
              <input className="input" value={form.siblingsName || ''} onChange={e => set('siblingsName', e.target.value)} placeholder="Comma-separated names" />
            </div>
            <div className="col-span-2">
              <label className="inline-flex items-center gap-2 text-sm text-stone-700 mt-1">
                <input
                  type="checkbox"
                  checked={form.isActiveThisSeason !== false}
                  onChange={e => set('isActiveThisSeason', e.target.checked)}
                  className="rounded"
                />
                Include on Sign In / Out this season
              </label>
            </div>
          </div>

          <div className="col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-stone-700 mt-1">
              <input
                type="checkbox"
                checked={form.can_leave_alone || false}
                onChange={e => set('can_leave_alone', e.target.checked)}
                className="rounded"
              />
              Can leave by themselves if aged 11 or over
            </label>
          </div>
        </section>

        {/* Contacts */}
        <section>
          <h4 className="font-display font-semibold text-sm text-forest-700 mb-3 pb-1 border-b border-stone-100">
            Parent / Guardian Contact
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Primary Adult Name</label>
              <input className="input" value={form.parentName} onChange={e => set('parentName', e.target.value)} placeholder="Parent name" />
            </div>
            <div>
              <label className="label">Primary Adult Phone</label>
              <input className="input" type="tel" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} placeholder="+44 7700 000000" />
            </div>
            <div>
              <label className="label">Primary Adult Email</label>
              <input className="input" type="email" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} placeholder="parent@email.com" />
            </div>
            <div>
              <label className="label">Additional Adult Name</label>
              <input className="input" value={form.parent2Name || ''} onChange={e => set('parent2Name', e.target.value)} placeholder="Second parent / guardian" />
            </div>
            <div>
              <label className="label">Additional Adult Phone</label>
              <input className="input" type="tel" value={form.parent2Phone || ''} onChange={e => set('parent2Phone', e.target.value)} placeholder="+44 7700 000000" />
            </div>
            <div>
              <label className="label">Additional Adult Email</label>
              <input className="input" type="email" value={form.parent2Email || ''} onChange={e => set('parent2Email', e.target.value)} placeholder="adult@email.com" />
            </div>
            <div>
              <label className="label">Home Phone</label>
              <input className="input" type="tel" value={form.homePhone || ''} onChange={e => set('homePhone', e.target.value)} placeholder="020 7000 0000" />
            </div>
            {initial.id && participants.length > 0 && (
              <div className="col-span-2 space-y-2">
                <label className="label">Linked Participant(s) for Parent Info Updates</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={autoSelectLikelySiblings} className="btn-secondary text-xs px-2.5 py-1">
                    Auto-select likely siblings
                  </button>
                  <button type="button" onClick={() => setLinkedParticipantIds([initial.id])} className="btn-secondary text-xs px-2.5 py-1">
                    Reset to this participant
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-stone-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {participants
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(p => {
                      const checked = linkedParticipantIds.includes(p.id)
                      return (
                        <label key={p.id} className="inline-flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLinkedParticipant(p.id)}
                            className="rounded border-stone-300 text-forest-600 focus:ring-forest-500"
                          />
                          <span>{p.name}</span>
                        </label>
                      )
                    })}
                </div>
                <p className="text-xs text-stone-500">
                  Parent details and approved adults will update for {linkedParticipantIds.length || 1} selected participant(s).
                </p>
              </div>
            )}
            <div className="col-span-2">
              <label className="label">Approved Adults for Collection</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  className="input"
                  value={newApprovedAdultName}
                  onChange={e => setNewApprovedAdultName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addApprovedAdult() } }}
                  placeholder="Adult name"
                />
                <input
                  className="input"
                  value={newApprovedAdultRelationship}
                  onChange={e => setNewApprovedAdultRelationship(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addApprovedAdult() } }}
                  placeholder="Relationship"
                />
                <input
                  className="input"
                  type="tel"
                  value={newApprovedAdultPhone}
                  onChange={e => setNewApprovedAdultPhone(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addApprovedAdult() } }}
                  placeholder="Phone (optional)"
                />
              </div>
              <div className="mt-2">
                <button type="button" onClick={addApprovedAdult} className="btn-secondary h-11">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {approvedAdultsList.length === 0 ? (
                  <p className="text-sm text-stone-500">No approved adults recorded yet.</p>
                ) : approvedAdultsList.map((adult, index) => (
                  <button
                    key={`${adult}-${index}`}
                    type="button"
                    onClick={() => removeApprovedAdult(index)}
                    className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-sm text-stone-700 hover:border-forest-300"
                  >
                    {adult}
                    <Trash2 size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Medical */}
        <section>
          <h4 className="font-display font-semibold text-sm text-forest-700 mb-3 pb-1 border-b border-stone-100">
            Consents
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="label">Photo Consent</label>
              <select className="input" value={form.photoConsent || ''} onChange={e => set('photoConsent', e.target.value)}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="internal">For internal use only</option>
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-stone-700 mt-7">
              <input
                type="checkbox"
                checked={Boolean(form.otcConsent)}
                onChange={e => set('otcConsent', e.target.checked)}
                className="rounded"
              />
              OTC meds consent
            </label>
            <div className="sm:col-span-2">
              <label className="label">OTC Allowed Items</label>
              <input
                className="input"
                value={otcAllowedItemsInput}
                onChange={e => setOtcAllowedItemsInput(e.target.value)}
                placeholder="Calpol, antiseptic cream, antihistamine"
              />
              <p className="text-xs text-stone-500 mt-1">Comma-separated list.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">OTC Notes</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={form.otcNotes}
                onChange={e => set('otcNotes', e.target.value)}
                placeholder="Any restrictions or dosage notes"
              />
            </div>
          </div>

          <h4 className="font-display font-semibold text-sm text-forest-700 mb-3 pb-1 border-b border-stone-100">
            Medical / Allergy / Dietary
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
      : type === 'Dietary' ? 'bg-emerald-600 text-white border-emerald-600'
      : 'bg-white text-stone-600 border-stone-200'
    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
}`}
>
                    {type}
                  </button>
                ))}
              </div>
            </div>
            {form.medicalType.includes('Dietary') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Dietary Type</label>
                  <input
                    className="input"
                    value={form.dietaryType || ''}
                    onChange={e => set('dietaryType', e.target.value)}
                    placeholder="Vegetarian, halal, no dairy"
                  />
                </div>
                <div>
                  <label className="label">Dietary Details</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={form.mealAdjustments || ''}
                    onChange={e => set('mealAdjustments', e.target.value)}
                    placeholder="Specific dietary requirements, substitutions, portions, timings"
                  />
                </div>
              </div>
            )}
            {form.medicalType.includes('Medical') && (
              <div>
                <label className="label">Medical Details</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={form.medicalDetails}
                  onChange={e => set('medicalDetails', e.target.value)}
                  placeholder="Describe medical conditions, medications, symptoms, treatment guidance"
                />
              </div>
            )}
            {form.medicalType.includes('Allergy') && (
              <div>
                <label className="label">Allergy Details</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={form.allergyDetails || ''}
                  onChange={e => set('allergyDetails', e.target.value)}
                  placeholder="Allergen list and reaction severity"
                />
              </div>
            )}
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
            {form.sendDiagnosed && (
              <div>
                <label className="label">Diagnosis</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={form.sendDiagnosis || ''}
                  onChange={e => set('sendDiagnosis', e.target.value)}
                  placeholder="e.g., ADHD, Autism, Dyslexia..."
                />
              </div>
            )}
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
