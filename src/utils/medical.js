export function hasRecordedEpiPen(value) {
  const explicit = value?.hasEpiPen ?? value?.has_epipen
  if (explicit === true) return true

  const allergyDetails = String(value?.allergyDetails || value?.allergy_details || '').trim()
  return /epi\s*-?\s*pen|epinephrine\s+auto\s*-?\s*injector/i.test(allergyDetails)
}