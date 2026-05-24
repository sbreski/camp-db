import { useState, useRef } from 'react'
import { Upload, X, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react'
import ViewportOverlay from './ViewportOverlay'

// Map common header names to our field keys
const FIELD_MAP = {
  name: ['name', 'full name', 'fullname', 'participant', 'participant name', 'child name', 'child'],
  pronouns: ['pronouns', 'pronoun'],
  age: ['age'],
  birthday: ['birthday', 'date of birth', 'birth date', 'dob', 'date_of_birth'],
  address: ['address'],
  postcode: ['postcode', 'post code'],
  schoolAttending: ['school attending'],
  parentName: ['parent', 'guardian', 'parent name', 'guardian name', 'parent/guardian'],
  parentEmail: ['email', 'parent email', 'guardian email', 'e-mail'],
  parentPhone: ['phone', 'mobile', 'telephone', 'contact number', 'parent phone', 'phone number'],
  siblings: ['siblings', 'sibling'],
  siblingsName: ['siblings name', 'sibling name', 'names of siblings'],
  familyGroupKey: ['family group key', 'family_group_key'],
  approvedAdults: ['approved adults', 'approved', 'authorised adults', 'authorized adults', 'collection', 'please provide names of adults permitted to pick up my child from camp this will be separated by commas'],
  can_leave_alone: ['can leave alone', 'can_leave_alone', 'leave alone', 'can go home alone', 'self leave', 'permission to leave unaccompanied', 'permission to leave unaccompanied wording for answer is i give my child permission to travel home by themselves only relevant to pupils 11 or myself or an authorised adult named below will collect my child after each session'],
  medicalType: ['medical type', 'medical types', 'medical category', 'medical categories'],
  medicalDetails: ['medical', 'medical details', 'medical info', 'health', 'allergies', 'dietary', 'does your child have any medical conditions we should be aware of', 'medical info', 'does your child need to take medication during the camp day', 'medication details'],
  dietaryType: ['dietary type', 'dietary requirements', 'dietary'],
  allergyDetails: ['allergy details', 'allergies', 'allergy info', 'please tell us about any allergies intolerances or dietary requirements your child has'],
  sendNeeds: ['send', 'send needs', 'support', 'support needs', 'additional needs', 'sen', 'does your child have any additional needs or require adjustments to take part fully in the camp', 'additional needs send support'],
  sendDiagnosed: ['send diagnosed', 'send_diagnosed', 'diagnosed send', 'does your child have an ehcp or receive additional support in school for example learning support or regular adult support', 'ehcp diagnosed'],
  sendDiagnosis: ['send diagnosis', 'send_diagnosis', 'diagnosis', 'if yes or not sure please tell us more', 'diagnosis if yes or not sure'],
  photoConsent: ['photo consent', 'photo_consent', 'photos'],
  otcConsent: ['otc consent', 'otc_consent', 'otc meds consent', 'otc'],
  notes: ['notes', 'additional notes', 'other', 'is there anything else youd like us to know to help your child have a positive experience at camp', 'declaration of additional needs i confirm that i have shared full details of my childs needs including any ehcp 1 1 support in school or other significant support requirements so that artsdepot and impact theatre company can plan appropriate support for the camp', 'declaration additional notes'],
}

const PRONOUNS_SELF_DESCRIBE_ALIASES = [
  'if you selected prefer to self describe please tell us your childs pronouns',
]

function normalizeHeader(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function rowValueByAliases(row, aliases = []) {
  const aliasSet = new Set(aliases.map(normalizeHeader))
  for (const [key, value] of Object.entries(row || {})) {
    if (aliasSet.has(normalizeHeader(key))) {
      return String(value || '').trim()
    }
  }
  return ''
}

function normalizeNameKey(name) {
  return String(name || '').trim().toLowerCase()
}

function getParticipantFamilyGroupKey(participant) {
  return String(participant?.familyGroupKey || participant?.family_group_key || '').trim()
}

function parseSiblingNames(value) {
  return String(value || '')
    .replace(/\band\b/gi, ',')
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function parseBoolean(value, defaultValue = false) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return defaultValue
  if (['true', '1', 'yes', 'y', 'on'].includes(raw)) return true
  if (['false', '0', 'no', 'n', 'off'].includes(raw)) return false
  if (raw.includes('yes')) return true
  if (raw.includes('no')) return false
  return defaultValue
}

function parseLeavePermission(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return false
  if (raw.includes('permission to travel home by themselves')) return true
  if (raw.includes('myself or an authorised adult') || raw.includes('myself or an authorized adult')) return false
  return parseBoolean(raw, false)
}

function parseSendDiagnosed(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return false
  if (raw.includes('not sure')) return true
  if (raw.includes('yes')) return true
  if (raw.includes('no')) return false
  return parseBoolean(raw, false)
}

function parseCsvList(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value || '')
    .split(/[;,|/\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function normalizeMedicalTypeList(value) {
  return parseCsvList(value)
    .map((item) => {
      const key = item.toLowerCase().trim()
      if (key.startsWith('allerg')) return 'Allergy'
      if (key.startsWith('diet')) return 'Dietary'
      if (key.startsWith('med')) return 'Medical'
      if (key === 'a') return 'Allergy'
      if (key === 'd') return 'Dietary'
      if (key === 'm') return 'Medical'
      return null
    })
    .filter(Boolean)
}

function isExplicitNegativeText(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return false
  return (
    text === 'no'
    || text === 'none'
    || text === 'n/a'
    || text === 'na'
    || text === 'nil'
    || text.startsWith('no ')
    || text.startsWith('none ')
    || text.includes('no allergies')
    || text.includes('no allergy')
    || text.includes('no dietary')
    || text.includes('no medical')
    || text.includes('nothing to declare')
  )
}

function splitAllergyDietaryText(value) {
  const raw = String(value || '').trim()
  if (!raw) return { allergyDetails: '', dietaryType: '' }
  if (isExplicitNegativeText(raw)) return { allergyDetails: '', dietaryType: '' }

  const parts = raw
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)

  const allergyKeywords = ['allerg', 'anaphyl', 'epi', 'intoleran', 'reaction']
  const dietaryKeywords = ['diet', 'vegetarian', 'vegan', 'halal', 'kosher', 'gluten', 'coeliac', 'celiac', 'lactose', 'dairy', 'pescatarian']

  const allergyParts = []
  const dietaryParts = []

  for (const part of parts) {
    const text = part.toLowerCase()
    const isAllergy = allergyKeywords.some(keyword => text.includes(keyword))
    const isDietary = dietaryKeywords.some(keyword => text.includes(keyword))

    if (isAllergy) allergyParts.push(part)
    if (isDietary) dietaryParts.push(part)
  }

  const allergyDetails = allergyParts.length > 0 ? allergyParts.join(', ') : ''
  const dietaryType = dietaryParts.length > 0 ? dietaryParts.join(', ') : ''

  return { allergyDetails, dietaryType }
}

function parseBirthday(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const parsed = new Date(`${raw}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : raw
  }

  const uk = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (uk) {
    const day = uk[1].padStart(2, '0')
    const month = uk[2].padStart(2, '0')
    const year = uk[3]
    const normalized = `${year}-${month}-${day}`
    const parsed = new Date(`${normalized}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : normalized
  }

  return null
}

function normalizePronounsValue(value) {
  const text = String(value || '').trim()
  if (!text) return ''

  const normalized = text
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')

  if (normalized === 'she/her' || normalized === 'she/they') return normalized
  if (normalized === 'he/him' || normalized === 'he/they') return normalized
  if (normalized === 'they/them') return normalized

  return text
}

function detectField(header) {
  const h = normalizeHeader(header)
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.map(normalizeHeader).includes(h)) return field
  }
  return null
}

function parseCSV(text) {
  const source = String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  const matrix = []
  let row = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]

    if (ch === '"') {
      if (inQuotes && source[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
      continue
    }

    if (ch === '\n' && !inQuotes) {
      row.push(current.trim())
      if (row.some(cell => String(cell || '').trim() !== '')) {
        matrix.push(row)
      }
      row = []
      current = ''
      continue
    }

    current += ch
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim())
    if (row.some(cell => String(cell || '').trim() !== '')) {
      matrix.push(row)
    }
  }

  if (matrix.length < 2) return { headers: [], rows: [] }

  const headers = matrix[0]
  const rows = matrix.slice(1).map(vals => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] || '' })
    return obj
  }).filter(r => Object.values(r).some(v => v))

  return { headers, rows }
}

export default function ImportParticipants({ onImport, onClose, existingParticipants = [] }) {
  const [step, setStep] = useState('upload') // upload | map | preview | done
  const [headers, setHeaders] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [mapping, setMapping] = useState({}) // fieldKey -> headerName
  const [importCounts, setImportCounts] = useState({ added: 0, updated: 0 })
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const OUR_FIELDS = Object.keys(FIELD_MAP)
  const FIELD_LABELS = {
    name: 'Full Name *', pronouns: 'Pronouns', age: 'Age', birthday: 'Birthday',
    address: 'Address', postcode: 'Postcode', schoolAttending: 'School Attending',
    parentName: 'Parent Name', parentEmail: 'Parent Email', parentPhone: 'Parent Phone',
    siblings: 'Siblings?', siblingsName: 'Siblings Name', familyGroupKey: 'Family Group Key',
    approvedAdults: 'Approved Adults', medicalDetails: 'Medical Details',
    can_leave_alone: 'Can Leave Alone',
    medicalType: 'Medical Type', dietaryType: 'Dietary Type', allergyDetails: 'Allergy Details',
    sendNeeds: 'SEND / Support Needs', sendDiagnosed: 'SEND Diagnosed', sendDiagnosis: 'SEND Diagnosis',
    photoConsent: 'Photo Consent', otcConsent: 'OTC Consent',
    notes: 'Notes',
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

  function normalizeName(name) {
    return String(name || '').trim().toLowerCase()
  }

  function linkImportedFamilies(list) {
    if (!Array.isArray(list) || list.length === 0) return list

    const importedByName = new Map()
    list.forEach((participant, index) => {
      const key = normalizeNameKey(participant.name)
      if (!key) return
      if (!importedByName.has(key)) importedByName.set(key, [])
      importedByName.get(key).push(index)
    })

    const existingByName = new Map()
    ;(existingParticipants || []).forEach(participant => {
      const key = normalizeNameKey(participant.name)
      if (!key || existingByName.has(key)) return
      existingByName.set(key, participant)
    })

    const parent = list.map((_, index) => index)

    function find(index) {
      if (parent[index] === index) return index
      parent[index] = find(parent[index])
      return parent[index]
    }

    function union(a, b) {
      const rootA = find(a)
      const rootB = find(b)
      if (rootA !== rootB) parent[rootB] = rootA
    }

    const anchorFamilyKeyByIndex = new Map()

    list.forEach((participant, index) => {
      const siblingNames = parseSiblingNames(participant.siblingsName)
      siblingNames.forEach(siblingName => {
        const siblingKey = normalizeNameKey(siblingName)
        if (!siblingKey) return

        const importedMatches = importedByName.get(siblingKey) || []
        if (importedMatches.length > 0) {
          importedMatches.forEach(matchIndex => union(index, matchIndex))
          return
        }

        const existingMatch = existingByName.get(siblingKey)
        const existingFamilyKey = getParticipantFamilyGroupKey(existingMatch)
        if (existingFamilyKey) {
          anchorFamilyKeyByIndex.set(index, existingFamilyKey)
        }
      })
    })

    const memberIndexesByRoot = new Map()
    list.forEach((_, index) => {
      const root = find(index)
      if (!memberIndexesByRoot.has(root)) memberIndexesByRoot.set(root, [])
      memberIndexesByRoot.get(root).push(index)
    })

    for (const memberIndexes of memberIndexesByRoot.values()) {
      const existingKey = memberIndexes
        .map(index => getParticipantFamilyGroupKey(list[index]))
        .find(Boolean)

      const anchoredKey = memberIndexes
        .map(index => anchorFamilyKeyByIndex.get(index))
        .find(Boolean)

      const hasSiblingSignal = memberIndexes.some(index => {
        const participant = list[index]
        const siblingNames = parseSiblingNames(participant.siblingsName)
        return Boolean(participant.siblings) || siblingNames.length > 0
      })

      const shouldCreateGroup = memberIndexes.length > 1 || hasSiblingSignal
      const familyGroupKey = existingKey || anchoredKey || (shouldCreateGroup ? `import-family:${crypto.randomUUID()}` : '')
      if (!familyGroupKey) continue

      memberIndexes.forEach(index => {
        list[index].familyGroupKey = familyGroupKey
      })
    }

    return list
  }

  function buildParticipants() {
    const built = rawRows.map(row => {
      const nameFromRow = String(row[mapping.name] || '').trim()
      const existing = existingParticipants.find(
        p => normalizeName(p.name) === normalizeName(nameFromRow)
      )
      // Reuse existing ID if matched so App.jsx routes this through the update path
      const p = { ...(existing || {}), id: existing ? existing.id : crypto.randomUUID(), _isUpdate: Boolean(existing) }
      OUR_FIELDS.forEach(field => {
        const header = mapping[field]
        if (!header) return
        const raw = row[header]
        if (field === 'age') {
          const parsed = parseInt(String(raw || '').trim(), 10)
          p.age = Number.isNaN(parsed) ? '' : parsed
          return
        }
        if (field === 'birthday') {
          const parsedBirthday = parseBirthday(raw)
          if (parsedBirthday !== null) {
            p.birthday = parsedBirthday
          }
          return
        }
        if (field === 'can_leave_alone') {
          p.can_leave_alone = parseLeavePermission(raw)
          return
        }
        if (field === 'siblings') {
          p.siblings = parseBoolean(raw, false)
          return
        }
        if (field === 'isActiveThisSeason') {
          p.isActiveThisSeason = parseBoolean(raw, true)
          return
        }
        if (field === 'sendDiagnosed' || field === 'otcConsent') {
          p[field] = field === 'sendDiagnosed' ? parseSendDiagnosed(raw) : parseBoolean(raw, false)
          return
        }
        if (field === 'medicalType') {
          p[field] = parseCsvList(raw)
          return
        }
        if (field === 'medicalDetails' || field === 'allergyDetails' || field === 'dietaryType') {
          p[field] = isExplicitNegativeText(raw) ? '' : (raw || '')
          return
        }
        if (field === 'photoConsent') {
          const normalized = String(raw || '').trim().toLowerCase()
          if (!normalized) {
            p.photoConsent = 'yes'
          } else if (normalized === 'internal use only' || normalized === 'internal') {
            p.photoConsent = 'internal'
          } else if (normalized === 'no') {
            p.photoConsent = 'no'
          } else {
            p.photoConsent = 'yes'
          }
          return
        }
        p[field] = raw || ''
      })

      p.medicalType = normalizeMedicalTypeList(p.medicalType)

      // If one combined form answer includes both allergy and dietary info,
      // split it into separate fields to keep records structured.
      if (p.allergyDetails || p.dietaryType) {
        const source = p.allergyDetails || p.dietaryType
        const split = splitAllergyDietaryText(source)
        if (split.allergyDetails) p.allergyDetails = split.allergyDetails
        if (!p.dietaryType && split.dietaryType) p.dietaryType = split.dietaryType
      }

      // Prefer explicit self-described pronouns when provided.
      const selfDescribedPronouns = rowValueByAliases(row, PRONOUNS_SELF_DESCRIBE_ALIASES)
      const pronounsText = String(p.pronouns || '').trim().toLowerCase()
      const pronounsIndicateSelfDescribe = pronounsText.includes('self describe') || pronounsText.includes('self-describe')
      if (selfDescribedPronouns && (!pronounsText || pronounsIndicateSelfDescribe)) {
        p.pronouns = selfDescribedPronouns
      }

      p.pronouns = normalizePronounsValue(p.pronouns)

      // Normalise medicalType from medicalDetails text
      if (p.medicalType.length === 0 && p.medicalDetails) {
        const types = []
        const d = p.medicalDetails.toLowerCase()
        if (!isExplicitNegativeText(d)) {
          if (d.includes('allerg')) types.push('Allergy')
          if (d.includes('medical') || d.includes('asthma') || d.includes('diabetes') || d.includes('inhaler')) types.push('Medical')
          if (d.includes('vegetarian') || d.includes('vegan') || d.includes('gluten') || d.includes('dietary') || d.includes('halal') || d.includes('kosher')) types.push('Dietary')
        }
        p.medicalType = types
      }

      if (!Array.isArray(p.medicalType)) p.medicalType = []
      if (p.sendDiagnosis && p.sendDiagnosed !== true) {
        const diagnosisText = String(p.sendDiagnosis || '').trim().toLowerCase()
        const isExplicitNo = diagnosisText === 'no'
          || diagnosisText === 'none'
          || diagnosisText === 'n/a'
          || diagnosisText === 'na'
          || diagnosisText.startsWith('no ')
          || diagnosisText.startsWith('none ')

        if (!isExplicitNo) {
          p.sendDiagnosed = true
        }
      }

      return p
    }).filter(p => p.name?.trim())

    return linkImportedFamilies(built)
  }

  const preview = buildParticipants()

  async function doImport() {
    setImportError('')
    setImporting(true)
    const result = await onImport(preview)
    setImporting(false)

    if (result && result.ok === false) {
      const firstError = Array.isArray(result.errors) && result.errors.length > 0
        ? result.errors[0]
        : 'Unknown import error.'
      setImportError(`Import could not complete: ${firstError}`)
      return
    }

    setImportCounts({
      added: preview.filter(p => !p._isUpdate).length,
      updated: preview.filter(p => p._isUpdate).length,
    })
    setStep('done')
  }

  function downloadTemplate() {
    const headers = [
      'Full Name',
      'Pronouns',
      'Age',
      'Date of Birth',
      'School Attending',
      'Postcode',
      'Address',
      'Siblings?',
      'Siblings Name',
      'Parent Name',
      'Parent Phone',
      'Parent Email',
      'Permission to Leave Unaccompanied',
      'Approved Adults',
      'Photo Consent',
      'Medical Type',
      'Medical Info',
      'Allergy Details',
      'Dietary Requirements',
      'Medication Details / OTC Notes',
      'Additional Needs / SEND Support',
      'EHCP / Diagnosed',
      'Diagnosis / If yes or not sure',
      'Declaration / Additional Notes',
      'Family Group Key',
    ].join(',')

    const blob = new Blob([headers + '\n'], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'participants_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ViewportOverlay className="bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
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
              {importError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-800 border border-red-200">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl text-sm text-amber-800 border border-amber-200">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>
                  {preview.filter(p => !p._isUpdate).length > 0 && (
                    <><strong>{preview.filter(p => !p._isUpdate).length} new</strong> participant{preview.filter(p => !p._isUpdate).length !== 1 ? 's' : ''} will be added. </>
                  )}
                  {preview.filter(p => p._isUpdate).length > 0 && (
                    <><strong>{preview.filter(p => p._isUpdate).length}</strong> existing participant{preview.filter(p => p._isUpdate).length !== 1 ? 's' : ''} will be updated. </>
                  )}
                  No duplicates will be created.
                </span>
              </div>
              <div className="overflow-x-auto max-h-72 border border-stone-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 sticky top-0">
                    <tr>
                      {['', 'Name', 'Age', 'Parent', 'Medical'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-stone-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {preview.map((p, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="px-3 py-2">
                          {p._isUpdate
                            ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Update</span>
                            : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">New</span>
                          }
                        </td>
                        <td className="px-3 py-2 font-medium text-forest-950">{p.name}</td>
                        <td className="px-3 py-2 text-stone-600">{p.age || '—'}</td>
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
                <button onClick={doImport} disabled={importing} className={`btn-primary flex-1 ${importing ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  {importing ? 'Importing...' : `Import (${preview.filter(p => !p._isUpdate).length} new${preview.filter(p => p._isUpdate).length > 0 ? `, ${preview.filter(p => p._isUpdate).length} updated` : ''})`}
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
                <p className="text-stone-500 mt-1">
                  {importCounts.added > 0 && <>{importCounts.added} participant{importCounts.added !== 1 ? 's' : ''} added. </>}
                  {importCounts.updated > 0 && <>{importCounts.updated} participant{importCounts.updated !== 1 ? 's' : ''} updated.</>}
                </p>
              </div>
              <button onClick={onClose} className="btn-primary px-8">Done</button>
            </div>
          )}
        </div>
      </div>
    </ViewportOverlay>
  )
}
