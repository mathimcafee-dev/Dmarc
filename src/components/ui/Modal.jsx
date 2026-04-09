import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, subtitle, children, footer, size = '' }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h3 style={{ color: 'var(--neutral-900)', margin: 0 }}>{title}</h3>
            {subtitle && <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{subtitle}</p>}
          </div>
          {onClose && (
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '0.25rem' }}>
              <X size={18} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
