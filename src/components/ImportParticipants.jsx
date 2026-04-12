import { useState, useRef } from 'react'
import { Upload, X, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react'

// Map common header names to our field keys
const FIELD_MAP = {
  name: ['name', 'full name', 'fullname', 'participant', 'participant name', 'child name', 'child'],
  pronouns: ['pronouns', 'pronoun'],
  age: ['age'],
  role: ['role', 'part', 'character', 'cast'],
  parentName: ['parent', 'guardian', 'parent name', 'guardian name', 'parent/guardian'],
  parentEmail: ['email', 'parent email', 'guardian email', 'e-mail'],
  parentPhone: ['phone', 'mobile', 'telephone', 'contact number', 'parent phone', 'phone number'],
  approvedAdults: ['approved adults', 'approved', 'authorised adults', 'authorized adults', 'collection'],
  medicalDetails: ['medical', 'medical details', 'medical info', 'health', 'allergies', 'dietary'],
  sendNeeds: ['send', 'send needs', 'support', 'support needs', 'additional needs', 'sen'],
  dressingRoom: ['dressing room', 'room', 'dressing'],
  notes: ['notes', 'additional notes', 'other'],
}

function detectField(header) {
  const h = header.toLowerCase().trim()
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.includes(h)) return field
  }
  return null
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  
  function parseLine(line) {
    const result = []
    let inQuotes = false, current = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += ch }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(l => {
    const vals = parseLine(l)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] || '' })
    return obj
  }).filter(r => Object.values(r).some(v => v))
  return { headers, rows }
}

export default function ImportParticipants({ onImport, onClose }) {
  const [step, setStep] = useState('upload') // upload | map | preview | done
  const [headers, setHeaders] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [mapping, setMapping] = useState({}) // fieldKey -> headerName
  const [imported, setImported] = useState(0)
  const fileRef = useRef()

  const OUR_FIELDS = Object.keys(FIELD_MAP)
  const FIELD_LABELS = {
    name: 'Full Name *', pronouns: 'Pronouns', age: 'Age', role: 'Role / Part',
    parentName: 'Parent Name', parentEmail: 'Parent Email', parentPhone: 'Parent Phone',
    approvedAdults: 'Approved Adults', medicalDetails: 'Medical Details',
    sendNeeds: 'SEND / Support Needs', dressingRoom: 'Dressing Room', notes: 'Notes',
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target.result
      const { headers, rows } = parseCSV(text)
      if (!headers.length) { alert('Could not parse file. Make sure it is a CSV with a header row.'); return }
      setHeaders(headers)
      setRawRows(rows)
      // Auto-detect mapping
      const autoMap = {}
      headers.forEach(h => {
        const field = detectField(h)
        if (field && !Object.values(autoMap).includes(h)) autoMap[field] = h
      })
      setMapping(autoMap)
      setStep('map')
    }
    reader.readAsText(file)
  }

  function buildParticipants() {
    return rawRows.map(row => {
      const p = { id: crypto.randomUUID() }
      OUR_FIELDS.forEach(field => {
        const header = mapping[field]
        if (header) p[field] = row[header] || ''
      })
      // Normalise medicalType from medicalDetails text
      if (p.medicalDetails) {
        const types = []
        const d = p.medicalDetails.toLowerCase()
        if (d.includes('allerg')) types.push('Allergy')
        if (d.includes('medical') || d.includes('asthma') || d.includes('diabetes') || d.includes('inhaler')) types.push('Medical')
        if (d.includes('vegetarian') || d.includes('vegan') || d.includes('gluten') || d.includes('dietary') || d.includes('halal') || d.includes('kosher')) types.push('Dietary')
        p.medicalType = types
      } else {
        p.medicalType = []
      }
      return p
    }).filter(p => p.name?.trim())
  }

  const preview = buildParticipants()

  function doImport() {
    onImport(preview)
    setImported(preview.length)
    setStep('done')
  }

  function downloadTemplate() {
    const headers = 'Name,Pronouns,Age,Role,Parent Name,Parent Email,Parent Phone,Approved Adults,Medical Details,SEND Needs,Dressing Room,Notes'
    const example = 'Jane Smith,she/her,10,Dorothy,Sarah Smith,sarah@email.com,07700000000,"Grandma Smith (Grandmother)",Allergy to nuts - carries EpiPen,,Room 1,'
    const blob = new Blob([headers + '\n' + example], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'participants_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 fade-in max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <h3 className="font-display font-bold text-forest-950 text-lg">Import Participants</h3>
            <p className="text-stone-500 text-sm mt-0.5">Upload a CSV file to add multiple participants at once</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto">
          {/* STEP: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed border-stone-200 rounded-2xl p-10 hover:border-forest-400 hover:bg-forest-50 transition-all">
                <Upload size={32} className="text-stone-300" />
                <div className="text-center">
                  <p className="font-display font-semibold text-forest-950">Drop a CSV file here</p>
                  <p className="text-stone-400 text-sm mt-1">or click to browse</p>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>
              <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl text-sm text-stone-600">
                <FileText size={16} className="text-forest-600 flex-shrink-0" />
                <span>Need a template? </span>
                <button onClick={downloadTemplate} className="text-forest-700 font-medium hover:underline flex items-center gap-1">
                  <Download size={13} /> Download CSV template
                </button>
              </div>
              <div className="text-xs text-stone-400 space-y-1">
                <p>• First row must be a header row with column names</p>
                <p>• Column names are detected automatically (Name, Age, Email, etc.)</p>
                <p>• You can remap any columns that aren't detected correctly</p>
                <p>• For Excel files: save as CSV first (File → Save As → CSV)</p>
              </div>
            </div>
          )}

          {/* STEP: Map columns */}
          {step === 'map' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-sm text-green-800 border border-green-200">
                <CheckCircle size={16} className="flex-shrink-0" />
                <span>{rawRows.length} rows found. Map the columns below, then preview.</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {OUR_FIELDS.map(field => (
                  <div key={field} className="flex items-center gap-3">
                    <label className="text-sm font-medium text-stone-700 w-40 flex-shrink-0">
                      {FIELD_LABELS[field]}
                    </label>
                    <select
                      className="input flex-1"
                      value={mapping[field] || ''}
                      onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value || undefined }))}
                    >
                      <option value="">— not imported —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('preview')} disabled={!mapping.name}
                  className={`btn-primary flex-1 ${!mapping.name ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  Preview Import ({rawRows.filter(r => r[mapping.name]?.trim()).length} participants)
                </button>
                <button onClick={() => setStep('upload')} className="btn-secondary">Back</button>
              </div>
            </div>
          )}

          {/* STEP: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl text-sm text-amber-800 border border-amber-200">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>Review before importing. This will <strong>add</strong> {preview.length} participants (existing ones are not affected).</span>
              </div>
              <div className="overflow-x-auto max-h-72 border border-stone-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 sticky top-0">
                    <tr>
                      {['Name', 'Age', 'Role', 'Parent', 'Medical'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-stone-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {preview.map((p, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="px-3 py-2 font-medium text-forest-950">{p.name}</td>
                        <td className="px-3 py-2 text-stone-600">{p.age || '—'}</td>
                        <td className="px-3 py-2 text-stone-600">{p.role || '—'}</td>
                        <td className="px-3 py-2 text-stone-600">{p.parentName || '—'}</td>
                        <td className="px-3 py-2">
                          {p.medicalType?.length > 0
                            ? p.medicalType.map(t => (
                              <span key={t} className={`mr-1 text-[10px] font-bold px-1 rounded ${
                                t === 'Allergy' ? 'bg-red-100 text-red-700' :
                                t === 'Medical' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                              }`}>{t[0]}</span>
                            ))
                            : <span className="text-stone-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button onClick={doImport} className="btn-primary flex-1">
                  Import {preview.length} Participants
                </button>
                <button onClick={() => setStep('map')} className="btn-secondary">Back</button>
              </div>
            </div>
          )}

          {/* STEP: Done */}
          {step === 'done' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div>
                <p className="font-display font-bold text-forest-950 text-xl">Import complete!</p>
                <p className="text-stone-500 mt-1">{imported} participants added successfully.</p>
              </div>
              <button onClick={onClose} className="btn-primary px-8">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
