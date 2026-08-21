import React from 'react'
import { GenderTipsReference } from './GenderTipsReference'

interface GenderTipsModalProps {
  onClose: () => void
}

// Modal wrapper for GenderTipsReference — same overlay pattern as
// ReportWordModal.tsx, used from both WordDetail.tsx and ArtikelRush.tsx.
export const GenderTipsModal: React.FC<GenderTipsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative max-w-md w-full bg-surface border border-border rounded-2xl p-6 shadow-lg text-left max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-faint hover:text-ink-muted text-lg font-bold"
          aria-label="Tutup"
        >
          ✕
        </button>
        <h2 className="font-display text-lg font-bold text-ink mb-4">Tips Pola Gender</h2>
        <GenderTipsReference />
      </div>
    </div>
  )
}
