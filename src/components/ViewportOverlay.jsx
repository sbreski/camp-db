import { createPortal } from 'react-dom'

export default function ViewportOverlay({ className = '', children, ...props }) {
  if (typeof document === 'undefined') return null

  const mergedClassName = `fixed inset-0 ${className}`.trim()
  return createPortal(
    <div className={mergedClassName} {...props}>
      {children}
    </div>,
    document.body,
  )
}
