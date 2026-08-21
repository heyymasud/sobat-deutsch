import { useState } from 'react'
import { DeckManager } from '../modules/srs/components/DeckManager'
import { ReviewSession } from '../modules/srs/components/ReviewSession'

export default function Flashcards() {
  const [activeReviewDeckId, setActiveReviewDeckId] = useState<number | null>(null)

  return activeReviewDeckId !== null ? (
    <ReviewSession deckId={activeReviewDeckId} onFinish={() => setActiveReviewDeckId(null)} />
  ) : (
    <DeckManager onStartReview={setActiveReviewDeckId} />
  )
}
