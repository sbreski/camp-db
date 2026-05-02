import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Upload, CheckCircle } from 'lucide-react'
import { supabase } from '../supabase.js'

function templateKeyForType(type, templates) {
  return templates.find(t => t.type === type)?.key || 'incident-accident'
}

export default function IncidentForm({
  participantId,
  participantName = '',
  participantAge = '',
  staffList = [],
  defaultStaffMember = '',
  initial = null,
  canEditSafeguarding = true,
  onSave,
  onCancel,
}) {
  const WALKTHROUGH_KEY = 'campdb_reporting_walkthrough_seen_v1'
  const defaultStaff = String(defaultStaffMember || '').trim()
    || staffList.find(s => s.name === 'Sam Brenner')?.name
    || staffList[0]?.name
    || 'Sam Brenner'

  const [form, setForm] = useState(() => ({
    type: 'Incident/Accident',
    staffMember: defaultStaff,
    followUpTiming: 'none',  // 'none' | 'today' | 'tomorrow'
    pdfName: null,
    pdfData: null,
    ...(initial || {}),
    id: initial?.id,
    pdfPayload: null,
  }))
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(templateKeyForType(initial?.type || 'Incident/Accident', [
    { key: 'incident-accident', type: 'Incident/Accident' },
    { key: 'mid-camp', type: 'Mid-Camp Assessment' },
    { key: 'send-assessment', type: 'SEND Assessment' },
    { key: 'safeguarding', type: 'Safeguarding' },
  ]))
  const [isReceivingPdf, setIsReceivingPdf] = useState(false)
  const [uploadNotice, setUploadNotice] = useState('')
  const [showWalkthrough, setShowWalkthrough] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(WALKTHROUGH_KEY) !== '1'
  })
  const formTypeRef = useRef(form.type)
  function dismissWalkthrough() {
    setShowWalkthrough(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WALKTHROUGH_KEY, '1')
    }
  }


  const templates = useMemo(() => ([
    {
      key: 'incident-accident',
      label: 'Incident/Accident',
      type: 'Incident/Accident',
      path: '/forms/incident-accident-reporting-form.html',
    },
    {
      key: 'mid-camp',
      label: 'Mid-Camp Assessment',
      type: 'Mid-Camp Assessment',
      path: '/forms/mid-camp-assessment-form.html',
    },
    {
      key: 'send-assessment',
      label: 'SEND Assessment',
      type: 'SEND Assessment',
      path: '/forms/send-assessment-form.html',
    },
    {
      key: 'safeguarding',
      label: 'Safeguarding',
      type: 'Safeguarding',
      path: '/forms/safeguarding-assessment-form.html',
    },
  ]), [])

  useEffect(() => {
    const nextType = initial?.type || 'Incident/Accident'
    const nextStaff = initial?.staffMember || defaultStaff
    setForm({
      ...(initial || {}),
      followUpTiming: initial?.followUpTiming || (initial?.followUpRequired ? 'tomorrow' : 'none'),
      pdfName: initial?.pdfName || null,
      pdfData: initial?.pdfData || null,
      id: initial?.id,
      type: nextType,
      staffMember: nextStaff,
      pdfPayload: null,
    })
    formTypeRef.current = nextType
    setSelectedTemplateKey(templateKeyForType(nextType, templates))
    setUploadNotice('')
  }, [initial?.id, initial?.type, initial?.staffMember, initial?.pdfName, initial?.pdfData, initial?.followUpRequired, initial?.followUpTiming, defaultStaff, templates])

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'type') formTypeRef.current = value
      return next
    })
  }

  async function uploadPdfFile(file, fileDisplayName) {
    const fileName = `${crypto.randomUUID()}-${fileDisplayName}`
    const uploadTargets = [
      { bucket: 'documents', filePath: `incidents/${fileName}` },
    ]

    let lastError = null

    for (const target of uploadTargets) {
      const { error } = await supabase.storage.from(target.bucket).upload(target.filePath, file)

      if (error) {
        lastError = error
        if (
          /bucket not found/i.test(error.message || '')
          || /not found/i.test(error.message || '')
          || /does not exist/i.test(error.message || '')
          || String(error.statusCode || error.status || '') === '400'
          || String(error.statusCode || error.status || '') === '404'
        ) {
          continue
        }
        throw error
      }

      const { data } = supabase.storage.from(target.bucket).getPublicUrl(target.filePath)
      set('pdfName', fileDisplayName)
      set('pdfData', data?.publicUrl || null)
      set('pdfPayload', null)
      return
    }

    throw new Error(lastError?.message || 'No storage bucket available for incident uploads.')
  }

  async function buildRestrictedPayload(file, fileDisplayName) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })

    setForm(prev => ({
      ...prev,
      pdfName: fileDisplayName,
      pdfData: null,
      pdfPayload: {
        base64Pdf: dataUrl,
        fileName: fileDisplayName,
        mimeType: file.type || 'application/pdf',
      },
    }))
  }

  async function saveSafeguardingReport(incidentId, payload) {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token

    if (!accessToken) {
      throw new Error('You must be logged in to save a safeguarding report')
    }

    const response = await fetch('/.netlify/functions/safeguarding-reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'create_report',
        participantId,
        incidentId,
        reportName: payload.fileName,
        base64Pdf: payload.base64Pdf,
        mimeType: payload.mimeType,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error || 'Failed to save safeguarding report')
    }
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5MB.')
      return
    }
    try {
      if (form.type === 'Safeguarding') {
        await buildRestrictedPayload(file, file.name)
      } else {
        await uploadPdfFile(file, file.name)
      }
      setUploadNotice(`Form attached: ${file.name}`)
    } catch (error) {
      alert('Failed to upload file: ' + error.message)
    } finally {
      e.target.value = ''
    }
  }

  useEffect(() => {
    async function handleFormPdfMessage(event) {
      if (event.origin !== window.location.origin) return
      if (!event.data || typeof event.data !== 'object') return
      if (event.data.type !== 'campdb-form-pdf') return

      const payload = event.data.payload || {}
      const rawBase64 = payload.base64Pdf || ''
      const fileName = payload.fileName || `form-${Date.now()}.pdf`

      if (!rawBase64) {
        alert('The form did not return a PDF payload.')
        return
      }

      setIsReceivingPdf(true)
      try {
        const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64
        const binary = atob(cleanBase64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i)
        }

        const blob = new Blob([bytes], { type: payload.mimeType || 'application/pdf' })
        const file = new File([blob], fileName, { type: 'application/pdf' })

        if (file.size > 5 * 1024 * 1024) {
          alert('Generated PDF is over 5MB. Please reduce size and try again.')
          return
        }

        if (formTypeRef.current === 'Safeguarding') {
          await buildRestrictedPayload(file, fileName)
        } else {
          await uploadPdfFile(file, fileName)
        }
        setUploadNotice(`Form attached: ${fileName}`)
      } catch (error) {
        alert('Failed to receive PDF from form: ' + error.message)
      } finally {
        setIsReceivingPdf(false)
      }
    }

    window.addEventListener('message', handleFormPdfMessage)
    return () => window.removeEventListener('message', handleFormPdfMessage)
  }, [])

  const selectedTemplate = templates.find(t => t.key === selectedTemplateKey)
  const hasAttachment = Boolean(form.pdfName || form.pdfData || form.pdfPayload)
  const isNewIncident = !initial?.id
  const iframeSrc = selectedTemplate
    ? `${selectedTemplate.path}?participantId=${encodeURIComponent(participantId)}&participantName=${encodeURIComponent(participantName || '')}&participantAge=${encodeURIComponent(participantAge === null || participantAge === undefined ? '' : String(participantAge))}&staffMember=${encodeURIComponent(form.staffMember || '')}&new=${isNewIncident ? '1' : '0'}`
    : ''

  async function handleSubmit(e) {
    e.preventDefault()

    if (form.type === 'Safeguarding' && !canEditSafeguarding) {
      alert('Only authorised safeguarding users can edit safeguarding submissions.')
      return
    }

    const isEditing = Boolean(initial?.id)
    const incidentId = form.id || crypto.randomUUID()
    const nextForm = { ...form, id: incidentId }

    // Derive DB fields from the UI-only followUpTiming selector, then strip it.
    const timing = nextForm.followUpTiming || 'none'
    const followUpRequired = timing !== 'none'
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const followUpDueDate = timing === 'today' ? today : timing === 'tomorrow' ? tomorrow : (nextForm.followUpDueDate || null)

    const incidentRecord = {
      ...nextForm,
      followUpRequired,
      followUpDueDate,
      // Strip client-only fields that have no DB column.
      followUpTiming: undefined,
      pdfPayload: undefined,
    }

    if (!hasAttachment) {
      alert('Attach the completed form before saving this report.')
      return
    }

    try {
      await onSave(incidentRecord)
      if (nextForm.type === 'Safeguarding' && nextForm.pdfPayload) {
        await saveSafeguardingReport(incidentId, nextForm.pdfPayload)
      }
    } catch (error) {
      alert(error.message || 'Failed to save incident')
    }
  }

  const staffNames = (() => {
    const names = staffList.length > 0 ? staffList.map(s => s.name) : []
    if (!names.includes(defaultStaff)) names.unshift(defaultStaff)
    return names.length > 0 ? names : ['Sam Brenner']
  })()

  return (
    <div className="border-2 border-amber-200 bg-amber-50 rounded-xl p-4 mb-4 fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display font-semibold text-forest-950">{initial?.id ? 'Edit Submission' : 'Log Incident / Accident'}</h4>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
      </div>
      {showWalkthrough && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-stone-700">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-forest-900 mb-1">How this works</p>
              <p>1) Complete a form, 2) confirm attachment, 3) save report. A pickup handover note is added automatically for today.</p>
            </div>
            <button type="button" onClick={dismissWalkthrough} className="text-stone-400 hover:text-stone-600" aria-label="Dismiss walkthrough">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className={`rounded-lg border px-2.5 py-2 text-xs ${selectedTemplate ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-600'}`}>
          <span className="font-semibold">Step 1:</span> Form selected
        </div>
        <div className={`rounded-lg border px-2.5 py-2 text-xs ${hasAttachment ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-600'}`}>
          <span className="font-semibold">Step 2:</span> Attachment ready
        </div>
        <div className={`rounded-lg border px-2.5 py-2 text-xs ${hasAttachment ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-white text-stone-600'}`}>
          <span className="font-semibold">Step 3:</span> Save report
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.type}
              onChange={e => {
                const nextType = e.target.value
                set('type', nextType)
                const matchingTemplate = templates.find(t => t.type === nextType)
                setSelectedTemplateKey(matchingTemplate?.key || '')
                setForm(prev => ({ ...prev, pdfName: null, pdfData: null, pdfPayload: null }))
                setUploadNotice('')
              }}
            >
              {templates.map(template => (
                <option key={template.key} value={template.type}>{template.type}</option>
              ))}
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

        <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 space-y-2">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Follow Up</p>
          <div className="flex flex-col sm:flex-row gap-2">
            {[
              { value: 'none', label: 'No follow up needed' },
              { value: 'today', label: "Follow up today — notify at pickup" },
              { value: 'tomorrow', label: "Follow up tomorrow's register" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-2 flex-1 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                form.followUpTiming === opt.value
                  ? 'border-forest-500 bg-forest-50 text-forest-800'
                  : 'border-stone-200 text-stone-700 hover:border-forest-300'
              }`}>
                <input
                  type="radio"
                  name="followUpTiming"
                  value={opt.value}
                  checked={form.followUpTiming === opt.value}
                  onChange={() => set('followUpTiming', opt.value)}
                  className="h-4 w-4 accent-forest-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Step 1: Complete an interactive form</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
            {templates.map(template => (
              <button
                key={template.key}
                type="button"
                onClick={() => {
                  setSelectedTemplateKey(template.key)
                  set('type', template.type)
                  setForm(prev => ({ ...prev, pdfName: null, pdfData: null, pdfPayload: null }))
                  setUploadNotice('')
                }}
                className={`text-left border rounded-lg p-2 text-sm transition-colors ${
                  selectedTemplateKey === template.key
                    ? 'border-forest-500 bg-forest-50 text-forest-800'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-forest-400'
                }`}
              >
                {template.label}
              </button>
            ))}
          </div>

          {selectedTemplate && (
            <div className="border border-stone-200 rounded-xl overflow-hidden bg-white mb-3">
              <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-xs text-stone-600">
                {isReceivingPdf
                  ? 'Receiving PDF from form...'
                  : 'Complete the form, then use its "Send PDF back to Camp DB" button to attach it automatically.'}
              </div>
              <iframe
                title={selectedTemplate.label}
                src={iframeSrc}
                className="w-full h-[520px] border-0"
              />
            </div>
          )}

          <label className="label">Step 2: Confirm attachment (or upload manually)</label>
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
          {uploadNotice && (
            <p className="text-xs text-green-700 mt-1">{uploadNotice}</p>
          )}
          {!hasAttachment && (
            <p className="text-xs text-amber-700 mt-1">No attachment yet. Complete the embedded form and send it back, or upload manually.</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" className={`btn-primary flex-1 ${!hasAttachment ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={!hasAttachment}>
            {initial?.id
              ? (form.type === 'Safeguarding' ? 'Step 3: Save Safeguarding Report' : 'Step 3: Save Updated Report')
              : (form.type === 'Safeguarding' ? 'Step 3: Save Safeguarding Report' : 'Step 3: Save Report to Participant')}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  )
}
