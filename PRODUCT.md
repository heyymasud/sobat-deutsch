# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Existing codebase: React 19 + Vite + TypeScript, Tailwind CSS 4, Supabase (auth + sync), Dexie (IndexedDB, local-first storage), MiniSearch (client-side dictionary search), vite-plugin-pwa. Not a greenfield decision — inherited from the running app.

## Users
Primary — "Rani", 21, mahasiswa, level A2, belajar mandiri untuk persiapan studi. Sesi 10–15 menit/hari, sering saat commute dengan koneksi tidak stabil. Terbiasa aplikasi modern, cepat bosan dengan UI padat, frustrasi karena sering salah artikel (der/die/das) meski hafal arti kata.

Secondary — "Bayu", 28, pekerja, mengikuti kursus formal A1, memakai app sebagai alat bantu penguat materi kelas, belajar di laptop malam hari, butuh referensi cepat tabel konjugasi & deklinasi.

Confirmed: mobile is the primary usage context (short sessions, on the go), but desktop must be a fully polished experience, not an afterthought (Bayu's evening laptop sessions).

## Product Purpose
Sobat Deutsch is a German dictionary + spaced-repetition learning app for A1–B1 learners. It solves five recurring pain points: unpredictable grammatical gender/plural, unreliable third-party online dictionaries, forgetting vocabulary without a review rhythm, confusing 4-case declension, and dated/rigid UI in existing language apps. Success = instant offline dictionary lookups, retained vocabulary via SRS, pattern-based grammar learning, and an experience that feels modern and enjoyable enough for daily use.

## Positioning
A full German dictionary (110,894 lemmas) that runs entirely client-side after a progressive background download — instant (<100ms) gender/plural/conjugation answers with zero network dependency at query time, unlike competitors that hit a live API. Combined with SRS review and grammar drilling (Artikel Rush, declension tables) in one coherent local-first tool, rather than a bare dictionary or a bare flashcard app.

## Operating Context
- Local-first architecture: dictionary search, SRS, and quizzes run entirely on-device (Dexie/IndexedDB); server is only for auth, cross-device progress sync, and search fallback for clients still mid-download (State A).
- Full dictionary (19.02MB structured, from ~1GB raw kaikki.org data) downloads progressively in the background via a Progressive Full Download state machine (A/B/C), non-blocking.
- PWA with offline capability; users learn in short bursts, often with unstable or no connectivity.
- Roles: Guest (local-only, default), Registered User/Student (synced), Teacher (can propose dictionary corrections, admin-approved), Admin (approves corrections, manages content).
- Dictionary data is read-only for end users (BR-DICT-01); corrections flow Teacher → Admin approval only.

## Capabilities and Constraints
In scope (v1): German–Indonesian/English dictionary with gender/article/plural/POS/level A1–B1, SRS flashcards (SM-2), Artikel Rush quiz mini-game, verb conjugation + 4-case declension table generator, auth incl. guest mode, cross-device sync, PWA offline, dark mode + WCAG AA baseline, TTS via browser Web Speech API.

Out of scope (v1): AI chatbot, grammar checker, leaderboards/XP/social competition, paid structured courses, native iOS/Android apps, C1–C2 levels, non-German target languages, deck sharing, payments/subscriptions.

Hard constraints: no third-party API dependency for dictionary data at runtime; dictionary licensing must permit app use with attribution; empty/NULL fields (e.g. missing gender or auxiliary verb) must never be displayed as if complete (BR-DICT-07); RLS must be active on all Supabase tables.

## Brand Commitments
Product name "Sobat Deutsch" is fixed and must be used. No other brand assets (logo, color palette, typeface) are locked — full visual identity is open for this redesign.

## Evidence on Hand
Full PRD at [docs/PRD.md](docs/PRD.md) and technical architecture at [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — both authoritative for requirements and data schema. No existing logo, marketing copy, testimonials, or press assets. No user research beyond the two personas defined in the PRD.

## Product Principles
1. Local-first, offline-capable: never let a UI decision introduce a hidden network dependency at query time.
2. Instant and lightweight: dictionary lookups and SRS review must feel fast (<100ms), reachable in ≤2 clicks, review batches completable in ~5 minutes.
3. Never fabricate completeness: NULL grammar fields must be visually distinct from confirmed data, never hidden or guessed.
4. Teach patterns, not memorization: UI for grammar (gender, conjugation, declension) should reinforce rules, not just display raw answer tables.
5. Replace "dated academic dictionary" feel entirely — this redesign's core mandate is emotional/visual modernization (G4), not incremental polish.

## Accessibility & Inclusion
WCAG AA baseline is an explicit v1 requirement (dark mode + basic accessibility, PRD §3.1). Must be preserved through the redesign, not treated as optional.
