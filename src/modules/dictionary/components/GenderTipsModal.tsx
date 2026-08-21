import React from 'react'
import { Modal } from '../../../components/Modal'
import { GenderTipsReference } from './GenderTipsReference'

interface GenderTipsModalProps {
  onClose: () => void
}

// Used from both WordDetail.tsx and ArtikelRush.tsx.
export const GenderTipsModal: React.FC<GenderTipsModalProps> = ({ onClose }) => {
  return (
    <Modal title="Tips Pola Gender" onClose={onClose}>
      <GenderTipsReference />
    </Modal>
  )
}
