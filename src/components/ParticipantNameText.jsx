export function participantDisplayName(participant, showDiagnosedHighlight = true, forceNoDiagnosedHighlight = false) {
  if (!participant) return ''
  if (forceNoDiagnosedHighlight) return participant.name
  const hasDiagnosisText = Boolean(String(participant.sendDiagnosis || '').trim())
  const hasDiagnosedSend = Boolean(participant.sendDiagnosed) || hasDiagnosisText
  return showDiagnosedHighlight && hasDiagnosedSend ? `${participant.name} *` : participant.name
}

export default function ParticipantNameText({
  participant,
  className = '',
  diagnosedClassName = 'text-green-700',
  showDiagnosedHighlight = true,
  forceNoDiagnosedHighlight = false,
}) {
  if (!participant) return null
  const hasDiagnosisText = Boolean(String(participant.sendDiagnosis || '').trim())
  const hasDiagnosedSend = Boolean(participant.sendDiagnosed) || hasDiagnosisText

  const classes = [
    className,
    'rounded px-1 -mx-1 transition-colors hover:bg-forest-100/70',
    showDiagnosedHighlight && hasDiagnosedSend && !forceNoDiagnosedHighlight ? diagnosedClassName : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={classes}>{participantDisplayName(participant, showDiagnosedHighlight, forceNoDiagnosedHighlight)}</span>
}
