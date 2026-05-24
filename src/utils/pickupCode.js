const PICKUP_CODE_SEED = 739391

export function normalizePickupCodeInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 3)
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function hashString(input) {
  let hash = PICKUP_CODE_SEED
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash * 33) ^ input.charCodeAt(i)) >>> 0
  }
  return hash
}

export function getParticipantFamilyKey(participant) {
  const explicitFamilyGroupKey = normalizeText(participant?.familyGroupKey || participant?.family_group_key)
  if (explicitFamilyGroupKey) return `group:${explicitFamilyGroupKey}`

  const emailKey = normalizeText(participant?.parentEmail)
  if (emailKey) return `email:${emailKey}`

  const phoneKey = normalizePhone(participant?.parentPhone)
  if (phoneKey.length >= 7) return `phone:${phoneKey}`

  const parentNameKey = normalizeText(participant?.parentName)
  if (parentNameKey) return `name:${parentNameKey}`

  return `participant:${String(participant?.id || '').trim() || 'unknown'}`
}

export function buildDailyFamilyPickupCode(dateKey, familyKey) {
  const safeDate = String(dateKey || '').trim()
  const digits = safeDate.replace(/\D/g, '')
  if (digits.length !== 8) return '000'

  const safeFamilyKey = String(familyKey || '').trim() || 'family:unknown'
  const hash = hashString(`${digits}:${safeFamilyKey}`)

  return String(hash % 1000).padStart(3, '0')
}

export function getPickupCodeOverrides(participant) {
  const raw = participant?.pickupCodeOverrides ?? participant?.pickup_code_overrides
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw
}

export function getParticipantPickupCode(participant, dateKey) {
  const overrides = getPickupCodeOverrides(participant)
  const overrideCode = normalizePickupCodeInput(overrides?.[dateKey])
  if (overrideCode.length === 3) return overrideCode

  return buildDailyFamilyPickupCode(dateKey, getParticipantFamilyKey(participant))
}

export function isValidParticipantPickupCode(value, participant, dateKey) {
  return normalizePickupCodeInput(value) === getParticipantPickupCode(participant, dateKey)
}
