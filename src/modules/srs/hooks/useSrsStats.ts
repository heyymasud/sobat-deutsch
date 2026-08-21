import { useEffect, useState } from 'react'
import { db } from '../../../core/db/dictionaryDb'
import { topMistakes } from '../components/mistakeStats'

export interface SrsStats {
  streak: number
  reviewsToday: number
  totalStudiedWords: number
  accuracyByPos: Record<string, { total: number; correct: number }>
  weeklyActivity: { date: string; count: number }[]
  mistakeWords: { lemma: string; mistakeCount: number }[]
  loading: boolean
}

const EMPTY: Omit<SrsStats, 'loading'> = {
  streak: 0,
  reviewsToday: 0,
  totalStudiedWords: 0,
  accuracyByPos: {},
  weeklyActivity: [],
  mistakeWords: [],
}

// Extracted from DeckManager so the same computation backs both the deck
// screen's quick summary and the dedicated Statistik page (S8-01, FR-STAT-03).
export function useSrsStats(): SrsStats {
  const [stats, setStats] = useState<Omit<SrsStats, 'loading'>>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const logs = await db.reviewLogs.orderBy('reviewedAt').toArray()
        const startOfDay = new Date().setHours(0, 0, 0, 0)

        const todayLogs = logs.filter((l) => l.reviewedAt >= startOfDay)
        const reviewsToday = todayLogs.length

        let currentStreak = 0
        const activeDays = new Set(logs.map((l) => new Date(l.reviewedAt).toDateString()))
        const checkDate = new Date()
        const todayStr = checkDate.toDateString()
        if (!activeDays.has(todayStr)) {
          checkDate.setDate(checkDate.getDate() - 1)
        }
        while (activeDays.has(checkDate.toDateString())) {
          currentStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        }

        const studiedCardIds = new Set(logs.map((l) => l.cardId))
        const studiedWords = new Set<string>()
        const accuracyMap: Record<string, { total: number; correct: number }> = {}

        for (const cardId of studiedCardIds) {
          const card = await db.srsCards.get(cardId)
          if (card) {
            studiedWords.add(card.wordRef)
            const word = await db.dictionary.where('lemma').equals(card.wordRef).first()
            const pos = word?.pos?.toLowerCase() || 'lainnya'

            const cardLogs = logs.filter((l) => l.cardId === cardId)
            for (const log of cardLogs) {
              if (!accuracyMap[pos]) accuracyMap[pos] = { total: 0, correct: 0 }
              accuracyMap[pos].total++
              if (log.rating >= 3) accuracyMap[pos].correct++
            }
          }
        }

        const last7Days: { date: string; count: number }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const dateStr = d.toDateString()
          const count = logs.filter((l) => new Date(l.reviewedAt).toDateString() === dateStr).length
          last7Days.push({ date: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }), count })
        }

        const mistakes = await db.mistakeTracker.toArray()
        const mistakeWords = topMistakes(mistakes).map((m) => ({ lemma: m.wordRef, mistakeCount: m.mistakeCount }))

        if (!cancelled) {
          setStats({
            streak: currentStreak,
            reviewsToday,
            totalStudiedWords: studiedWords.size,
            accuracyByPos: accuracyMap,
            weeklyActivity: last7Days,
            mistakeWords,
          })
        }
      } catch (err) {
        console.error('Failed to load SRS stats:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { ...stats, loading }
}
