import type { DictionaryEntry } from '../../modules/dictionary/types'
import type { SrsCard } from '../db/dictionaryDb'

/**
 * SM-2 Algoritma scheduler.
 * Mengembalikan interval baru (dalam hari), easeFactor baru, repetitions baru, dan dueDate baru (timestamp).
 */
export const calculateSm2 = (
  rating: number, // 1: Again, 2: Hard, 3: Good, 4: Easy
  currentInterval: number,
  currentEaseFactor: number,
  currentRepetitions: number
): { interval: number; easeFactor: number; repetitions: number; dueDate: number } => {
  let interval = currentInterval
  let easeFactor = currentEaseFactor
  let repetitions = currentRepetitions

  if (rating === 1) {
    // Again (Lagi)
    repetitions = 0
    interval = 1
    easeFactor = Math.max(1.3, easeFactor - 0.2)
  } else if (rating === 2) {
    // Hard (Keras)
    repetitions = Math.max(1, repetitions)
    if (repetitions === 1) {
      interval = 1
    } else if (repetitions === 2) {
      interval = 3
    } else {
      interval = Math.round(interval * 1.2)
    }
    easeFactor = Math.max(1.3, easeFactor - 0.15)
  } else if (rating === 3) {
    // Good (Baik)
    repetitions += 1
    if (repetitions === 1) {
      interval = 1
    } else if (repetitions === 2) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
  } else if (rating === 4) {
    // Easy (Mudah)
    repetitions += 1
    if (repetitions === 1) {
      interval = 2
    } else if (repetitions === 2) {
      interval = 8
    } else {
      interval = Math.round(interval * easeFactor * 1.3)
    }
    easeFactor = easeFactor + 0.15
  }

  // Calculate next due date (interval is in days, convert to ms)
  const dueDate = Date.now() + interval * 24 * 60 * 60 * 1000

  return { interval, easeFactor, repetitions, dueDate }
}

/**
 * Interleave item queue supaya tidak ada run panjang dengan key yang sama
 * (mis. ablaut_class) berturut-turut. Urutan relatif di dalam masing-masing
 * grup key dipertahankan (stable) — jadi prioritas frequency_rank/dueDate
 * yang sudah disusun sebelum dipanggil tetap terjaga sebisa mungkin.
 *
 * PENTING (BR-SRS-04): keyFn TIDAK BOLEH mengambil tema/theme_tags — hanya
 * ablaut_class (atau kunci grammar lain) yang boleh dipakai untuk interleave.
 */
export const interleaveByKey = <T>(items: T[], keyFn: (item: T) => string | undefined | null): T[] => {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item) ?? '__none__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  if (groups.size <= 1) return items

  const result: T[] = []
  let lastKey: string | null = null
  const remaining = new Map(groups)

  while (remaining.size > 0) {
    // Pilih grup dengan sisa kartu terbanyak (biar merata), hindari grup yang sama
    // dengan kartu sebelumnya kalau ada pilihan lain.
    const candidates = [...remaining.entries()].sort((a, b) => b[1].length - a[1].length)
    const pick = candidates.find(([key]) => key !== lastKey) ?? candidates[0]
    const [key, arr] = pick
    result.push(arr.shift()!)
    if (arr.length === 0) remaining.delete(key)
    lastKey = key
  }

  return result
}

/**
 * Membuat kartu belajar otomatis berdasarkan jenis kata dan atribut tata bahasanya.
 */
export const generateCardsForWord = (word: DictionaryEntry, deckId: number): Omit<SrsCard, 'id'>[] => {
  const cards: Omit<SrsCard, 'id'>[] = []
  const now = Date.now()

  // 1. Meaning card (Arti Jerman -> Terjemahan) untuk semua kata
  cards.push({
    deckId,
    wordRef: word.lemma,
    cardType: 'arti',
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    dueDate: now,
    createdAt: now,
    updatedAt: now,
  })

  const isNoun = word.pos?.toLowerCase() === 'noun'
  const isVerb = word.pos?.toLowerCase() === 'verb'
  
  if (isNoun) {
    // 2. Gender card (Menyebutkan artikel der/die/das)
    if (word.gender) {
      cards.push({
        deckId,
        wordRef: word.lemma,
        cardType: 'gender',
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        dueDate: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    // 3. Plural card (Menyebutkan bentuk plural dari kata)
    if (word.plural) {
      cards.push({
        deckId,
        wordRef: word.lemma,
        cardType: 'plural',
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        dueDate: now,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  if (isVerb) {
    // 4. Cloze card untuk verb + preposisi + kasus (S7-01)
    if (word.case_governance && word.case_governance.length > 0) {
      cards.push({
        deckId,
        wordRef: word.lemma,
        cardType: 'cloze-kasus',
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        dueDate: now,
        createdAt: now,
        updatedAt: now,
      })
    }

    // 5. Conjugation card (S5-10)
    if (word.conjugation_table) {
      cards.push({
        deckId,
        wordRef: word.lemma,
        cardType: 'konjugasi',
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        dueDate: now,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  return cards
}

/**
 * S9-05 (AC-SRS-07, BR-SRS-07): Pattern Drill hanya boleh tampil SEKALI per
 * ablaut_class yang baru ditemui, bukan setiap kali kartu jenis itu muncul.
 * seenClasses adalah state persisten (mis. dari localStorage) berisi ablaut_class
 * yang sudah pernah ditampilkan drill-nya.
 */
export const shouldShowPatternDrill = (
  ablautClass: string | null | undefined,
  seenClasses: Set<string>
): boolean => {
  if (!ablautClass) return false
  return !seenClasses.has(ablautClass)
}

/**
 * S9-06 (AC-SRS-09): akurasi sesi = proporsi rating "Baik"/"Mudah" (>=3) dari
 * seluruh rating yang diberikan selama sesi.
 */
export const calculateAccuracy = (ratings: number[]): number => {
  if (ratings.length === 0) return 0
  const correct = ratings.filter((r) => r >= 3).length
  return correct / ratings.length
}

/**
 * S9-07 (AC-SRS-11): state sesi yang persisted dianggap basi (jangan di-resume)
 * kalau sudah lebih tua dari maxAgeMs (default 6 jam) — mencegah resume ke sesi
 * kemarin yang sudah tidak relevan lagi dengan antrean due hari ini.
 */
export const isSessionStateFresh = (
  savedAt: number,
  now: number,
  maxAgeMs: number = 6 * 60 * 60 * 1000
): boolean => {
  return now - savedAt < maxAgeMs
}
