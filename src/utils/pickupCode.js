const PICKUP_CODE_SEED = 739391

export function normalizePickupCodeInput(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 3)
}

export function buildDailyPickupCode(dateKey) {
  const safeDate = String(dateKey || '').trim()
  const digits = safeDate.replace(/\D/g, '')
  if (digits.length !== 8) return '000'

  let hash = PICKUP_CODE_SEED
  for (let i = 0; i < digits.length; i += 1) {
    hash = ((hash * 33) ^ Number(digits[i])) >>> 0
  }

  return String(hash % 1000).padStart(3, '0')
}

export function isValidPickupCode(value, dateKey) {
  return normalizePickupCodeInput(value) === buildDailyPickupCode(dateKey)
}
