import React from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Tailwind max-width class for the panel. Default: max-w-md. */
  maxWidthClassName?: string
}

// Generic modal shell: title + close button stay fixed at the top, only the
// body scrolls. Reusable across the app (e.g. GenderTipsModal) instead of
// every feature reimplementing its own overlay/panel.
export const Modal: React.FC<ModalProps> = ({ title, onClose, children, maxWidthClassName = 'max-w-md' }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={`relative w-full ${maxWidthClassName} max-h-[80vh] flex flex-col bg-surface border border-border rounded-2xl shadow-lg text-left`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 p-6 pb-4 shrink-0">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="text-ink-faint hover:text-ink-muted text-lg font-bold shrink-0"
          >
            ✕
          </button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
