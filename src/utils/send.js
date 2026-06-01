function normalizeSendText(value) {
  return String(value || '').trim().toLowerCase()
}

export function isNegativeSendText(value) {
  const text = normalizeSendText(value)
  if (!text) return false

  return (
    text === 'no'
    || text === 'none'
    || text === 'n/a'
    || text === 'na'
    || text === 'nil'
    || text === 'nope'
    || text === 'nothing'
    || text === 'not applicable'
    || text.startsWith('no ')
    || text.startsWith('none ')
    || text.startsWith('n/a ')
    || text.startsWith('na ')
    || text.startsWith('nil ')
    || text.startsWith('no support need')
    || text.startsWith('no support required')
    || text.startsWith('no diagnosis')
    || text.includes('nothing to declare')
  )
}

export function hasMeaningfulSendText(value) {
  const text = normalizeSendText(value)
  return Boolean(text) && !isNegativeSendText(text)
}
