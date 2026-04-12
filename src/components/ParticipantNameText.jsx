export function participantDisplayName(participant, showDiagnosedHighlight = true) {
  if (!participant) return ''
  return showDiagnosedHighlight && participant.sendDiagnosed ? `${participant.name} *` : participant.name
}

export default function ParticipantNameText({
  participant,
  className = '',
  diagnosedClassName = 'text-green-700',
  showDiagnosedHighlight = true,
}) {
  if (!participant) return null

  const classes = [
    className,
    'rounded px-1 -mx-1 transition-colors hover:bg-forest-100/70',
    showDiagnosedHighlight && participant.sendDiagnosed ? diagnosedClassName : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <span className={classes}>{participantDisplayName(participant, showDiagnosedHighlight)}</span>
}
