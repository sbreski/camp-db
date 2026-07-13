import { hasRecordedEpiPen } from './medical'
import { hasMeaningfulSendText } from './send'

function parseApprovedAdults(str) {
  if (!str) return []
  return String(str).split(',').map(s => s.trim()).filter(Boolean)
}

function parseAdultEntry(entry) {
  const text = String(entry || '').trim()
  if (!text) return { name: '', relationship: '', phone: '' }

  const phoneMatch = text.match(/^(.*?)\s*-\s*(\+?[0-9][0-9\s()\-]{5,})\s*$/)
  const withoutPhone = phoneMatch ? phoneMatch[1].trim() : text
  const phone = phoneMatch ? phoneMatch[2].trim() : ''

  const match = withoutPhone.match(/^(.*?)\s*\((.*?)\)\s*$/)
  if (!match) return { name: withoutPhone, relationship: '', phone }
  return {
    name: (match[1] || '').trim(),
    relationship: (match[2] || '').trim(),
    phone,
  }
}

function stripParentSuffix(name) {
  const parsed = parseAdultEntry(name)
  const base = String(parsed.name || '').trim()
  return base.replace(/\s*\(parent\)$/i, '').trim()
}

function hasSameAdult(list, name) {
  const normalized = stripParentSuffix(name).toLowerCase()
  return list.some(a => stripParentSuffix(a).toLowerCase() === normalized)
}

function formatParentLabel(name, relationship = 'Parent') {
  const clean = stripParentSuffix(name)
  const rel = String(relationship || '').trim() || 'Parent'
  return clean ? `${clean} (${rel})` : ''
}

export function participantFlags(participant) {
  const hasEpiPen = hasRecordedEpiPen(participant)
  const hasMedical = Boolean(String(participant?.medicalCondition || '').trim() || String(participant?.medicalDetails || '').trim())
  const hasAllergy = Boolean(String(participant?.allergyDetails || '').trim()) || hasEpiPen
  const hasDietary = Boolean(String(participant?.dietaryType || '').trim() || String(participant?.mealAdjustments || '').trim())
  const hasSendDiagnosis = hasMeaningfulSendText(participant?.sendDiagnosis)
  const sendDiagnosed = Boolean(participant?.sendDiagnosed) || hasSendDiagnosis
  const hasSend = hasMeaningfulSendText(participant?.sendNeeds) || sendDiagnosed

  const letters = []
  if (hasMedical) letters.push('M')
  if (hasDietary) letters.push('D')
  if (hasAllergy) letters.push('A')
  if (hasSend) letters.push('S')

  return {
    hasEpiPen,
    hasMedical,
    hasAllergy,
    hasDietary,
    hasSend,
    hasSendDiagnosis,
    sendDiagnosed,
    letters,
    text: letters.join('/'),
  }
}

export function parseMedicalFlags(value) {
  const text = String(value || '').toUpperCase()
  const found = new Set()
  for (const ch of text) {
    if (['M', 'D', 'A', 'S'].includes(ch)) found.add(ch)
  }
  return [...found]
}

export function normalizeParticipantRecord(record) {
  const next = { ...record }

  const flags = participantFlags(next)
  next.hasEpiPen = flags.hasEpiPen
  next.sendDiagnosed = flags.sendDiagnosed

  const legacyMedicalType = []
  if (flags.hasAllergy) legacyMedicalType.push('Allergy')
  if (flags.hasDietary) legacyMedicalType.push('Dietary')
  if (flags.hasMedical) legacyMedicalType.push('Medical')
  next.medicalType = legacyMedicalType

  const normalizedAdults = parseApprovedAdults(next.approvedAdults)

  const parent2Name = String(next.parent2Name || '').trim()
  if (parent2Name && !hasSameAdult(normalizedAdults, parent2Name)) {
    normalizedAdults.unshift(formatParentLabel(parent2Name, next.parent2Relationship || 'Parent'))
  }

  const parentName = String(next.parentName || '').trim()
  if (parentName && !hasSameAdult(normalizedAdults, parentName)) {
    normalizedAdults.unshift(formatParentLabel(parentName, next.parentRelationship || 'Parent'))
  }

  next.approvedAdults = normalizedAdults.join(', ')
  return next
}

export function normalizeParticipantList(list) {
  return (Array.isArray(list) ? list : []).map(normalizeParticipantRecord)
}
