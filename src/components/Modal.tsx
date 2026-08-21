import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const onChange = () => setIsMobile(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Sticky action row pinned below the scrollable body (e.g. Batal / Simpan). */
  footer?: React.ReactNode
  /** Tailwind max-width class for the desktop panel. Default: max-w-md. */
  maxWidthClassName?: string
}

// Generic modal shell: title stays fixed at the top, footer (if given) stays
// fixed at the bottom, only the body between them scrolls. On mobile it
// renders as a drag-to-dismiss bottom sheet instead of a centered dialog.
// Reusable across the app instead of every feature reimplementing its own
// overlay/panel.
export const Modal: React.FC<ModalProps> = ({ title, onClose, children, footer, maxWidthClassName = 'max-w-md' }) => {
  const isMobile = useIsMobile()

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4" onClick={onClose}>
      <motion.div
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
        transition={isMobile ? { type: 'spring', damping: 32, stiffness: 340 } : { duration: 0.15 }}
        drag={isMobile ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (isMobile && (info.offset.y > 80 || info.velocity.y > 500)) onClose()
        }}
        className={`relative flex w-full max-h-[85vh] flex-col bg-surface border border-border shadow-lg text-left touch-none ${
          isMobile ? 'rounded-t-3xl' : `${maxWidthClassName} max-h-[80vh] rounded-2xl`
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" />}

        <div className="flex items-center justify-between gap-4 p-6 pb-4 shrink-0">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-surface-muted hover:text-ink-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {children}
        </div>

        {footer && <div className="shrink-0 border-t border-border p-4">{footer}</div>}
      </motion.div>
    </div>
  )
}
