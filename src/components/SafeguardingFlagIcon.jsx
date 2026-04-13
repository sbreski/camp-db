import { ShieldAlert } from 'lucide-react'

export default function SafeguardingFlagIcon({ className = '', title = 'Safeguarding flag', size = 12 }) {
  const classes = `inline-flex items-center justify-center rounded border border-rose-200 bg-rose-100 text-rose-800 px-1.5 py-0.5 ${className}`.trim()

  return (
    <span className={classes} title={title} aria-label={title}>
      <ShieldAlert size={size} strokeWidth={2.1} />
    </span>
  )
}
