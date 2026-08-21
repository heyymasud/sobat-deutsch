# Codebase Baseline — Sobat Deutsch

> Dokumen ini memetakan kondisi **nyata** codebase saat ini (bukan rencana), diverifikasi langsung dari kode/skema, bukan dari dokumen lama. Dibuat sebagai prasyarat `plan-feature-delta` sebelum merencanakan fitur baru.
>
> Versi: 1.0 — 2026-08-21
> Scope: full codebase (semua module), dengan kedalaman ekstra di dictionary/data-pipeline/search karena fitur berikutnya yang direncanakan menyentuh area itu.

---

## 1. Summary

- **Jenis aplikasi**: Kamus Jerman-Indonesia/Inggris + SRS (spaced repetition, mirip SM-2/Anki), local-first PWA, dengan role Student/Teacher/Admin, sync ke Supabase.
- **Stack terverifikasi** (`package.json:1-31`):
  - Frontend: React 19.2, React Router 6.30, Vite 8, TypeScript 6 (strict, `tsc -b`), Tailwind 4.
  - Local DB: `dexie` 4.0 + `dexie-react-hooks` (IndexedDB wrapper).
  - Local search: `minisearch` 7.1 (**bukan** FlexSearch — lihat §5, dokumen lama masih menyebut FlexSearch).
  - Backend: `@supabase/supabase-js` 2.48 (Postgres + Auth + Edge Functions Deno, `supabase/functions/*`).
  - Testing: `vitest` 3.0, terpasang dan aktif dipakai (10 file test nyata).
  - Lint: `oxlint`. Error tracking: `@sentry/react`.
  - `data-pipeline/` — Python (`scripts/*.py`, `psycopg2`), terpisah dari runtime Node (sesuai mandat proyek).
- **Skala/usia**: hanya 3 commit di git log (`ef3fdd5` initial commit, `8002ed5` feat Sprint 9, `95c3a44` fix race condition) — codebase muda, di-import sebagai satu initial commit besar, bukan histori bertahap organik.

## 2. Module Structure

| Direktori | Tanggung jawab | Maturity |
|---|---|---|
| `src/modules/dictionary/` | Search bar, halaman detail kata (gender, plural, konjugasi), laporan kata salah | Stable — ada test (`WordDetail.test.ts`) |
| `src/core/search/searchService.ts` | Router State A/B/C (online vs local MiniSearch), tiering hasil | Stable — well-tested, banyak edge-case terdokumentasi |
| `src/core/dictSync/syncManager.ts` | Cek versi, unduh kamus penuh, verifikasi checksum, swap atomik staging→live | Stable — ada test |
| `src/core/db/dictionaryDb.ts` | Skema Dexie lokal | Stable, migration history rapi (v1→v5) |
| `data-pipeline/` + `scripts/*.py` | Pipeline Kaikki/Wiktionary → SQLite → Postgres → export JSON client | Stable/mature, **tanpa automated test** (hanya `validate_dictionary.py` manual) |
| `src/core/srs/` | Scheduler SRS (SM-2-like) | Stable, ada test |
| `src/core/sync/` | Sync queue offline→online | Stable, ada test, baru di-fix race condition di commit terakhir |
| `src/modules/srs/` | UI Deck, ReviewSession, hooks | Stable, ada test |
| `src/modules/quiz/` | Kuis pilihan artikel (gender) | Stable-ish, ada test |
| `src/modules/auth/` | Login/register/guest | In-progress/thin, tidak ada test |
| `src/modules/sync/` | UI indikator status sync | Stable kecil, ada test |
| `src/modules/admin/` | Review word_reports & dictionary_suggestions, approve teacher | In-progress — 1 file besar (`AdminConsole.tsx` >400 baris), **tidak ada test** |
| `src/modules/teacher/` | Teacher submit saran koreksi kamus | In-progress, **tidak ada test** |

## 3. Existing Data Schema

Sumber: migration SQL nyata di `supabase/migrations/*.sql` (lebih otoritatif daripada `docs/ARCHITECTURE.md` — lihat §5, sebagian sudah drift).

**Tabel `dictionary`** (`supabase/migrations/20260820000004_dictionary.sql`):
```
id bigint PK (identity)
lemma text not null
pos text
gender text check ('m','f','n', NULL)
plural text
genitiv_singular text        -- selalu NULL, belum diisi pipeline
translations text            -- SATU-SATUNYA kolom arti kata, isi gloss EN dari Kaikki/Wiktionary, dipisah " | ", max 3 sense
example text
separable_prefix text
auxiliary text check ('haben','sein','both', NULL)
verb_class text check ('weak','strong','mixed','irregular', NULL)
ablaut_class text
case_governance text[]
conjugation_table jsonb
comparative text             -- belum diisi
superlative text             -- belum diisi
level text check ('A1','A2','B1', NULL)
theme_tags text[]            -- belum diisi
frequency_rank int
updated_at timestamptz
search_vector tsvector generated always as (
  setweight(to_tsvector('german', lemma), 'A') ||
  setweight(to_tsvector('german', translations), 'B')   -- FTS server hanya cover kolom translations (EN)
) stored
```
Index: `idx_dictionary_lemma (lower(lemma))`, `idx_dictionary_search USING gin(search_vector)`, `idx_dictionary_freq`. RLS: read-only publik + `admin_update_dictionary`.

**`dictionary_meta`**: `id, version, published_at, row_count, checksum, needs_reexport`.

**`word_reports`**: `id uuid PK, word_id FK dictionary, reporter_id FK auth.users (nullable/guest), note, status, created_at`.

**`dictionary_suggestions`** (skema aktual **berbeda dari dokumentasi lama**, lihat §5): `id uuid PK, word_id FK dictionary, proposed_by FK auth.users, proposed_data jsonb, status, reason_for_change, created_at, updated_at`. Unique `(word_id, proposed_by, status)`.

**Dexie lokal** (`src/core/db/dictionaryDb.ts:59-121`): tabel `dictionary`/`dictionaryStaging` diindeks `id, lemma, pos, gender, plural, frequency_rank, level` — kolom `translations` **tidak diindeks Dexie**, hanya field biasa dipakai MiniSearch.

**Local search index** (`searchService.ts:17-29`): MiniSearch field `['lemma','translations']`, fuzzy hanya untuk `lemma` (fuzzy pada translations sengaja dimatikan — bekas bug false-positive).

**Server search Edge Function** (`supabase/functions/dictionary-search/index.ts:56-65`): query `.or(lemma.ilike, lemma.imatch regex, translations.ilike)` — **hardcode nama kolom**, tidak dinamis.

## 4. Conventions & Patterns

- Feature-folder: `src/modules/<feature>/components/*.tsx` + `types.ts`; logic non-UI di `src/core/<concern>/`. Catatan: ada coupling dua arah — `core/db/dictionaryDb.ts` mengimpor type dari `modules/dictionary/types.ts`.
- State management: tanpa Redux/Zustand, hooks biasa + `dexie-react-hooks` live-query.
- Penamaan: PascalCase komponen, camelCase service/util.
- Testing: vitest aktif, 10 file test nyata, mayoritas menguji `core/*` (business logic), bukan komponen UI.
- Python pipeline tanpa test runner formal — hanya `validate_dictionary.py` sebagai gate manual.
- Migration SQL: satu file = satu perubahan fokus; banyak migration late adalah fix atas temuan audit sendiri (RLS/PK bolong) — pola tim: ship dulu, patch lubang belakangan.

## 5. Old Documentation Status

| Klaim di docs | Kode nyata | Status | Bukti |
|---|---|---|---|
| ARCHITECTURE.md menyebut "FlexSearch/MiniSearch" | Hanya `minisearch` terinstal & dipakai | Stale (minor) | `ARCHITECTURE.md:48,70,226` vs `package.json` |
| ARCHITECTURE.md skema `dictionary_suggestions`: `word_ref, field_name, current_value, suggested_value, submitted_by, reason_text` | Migration nyata: `word_id, proposed_by, proposed_data jsonb, reason_for_change` | **Stale (signifikan)** — desain sudah pivot ke jsonb blob | `ARCHITECTURE.md:377-389` vs `20260820000005_teacher_workflow.sql` |
| ARCHITECTURE.md `teacher_applications`: `reason_text, reviewed_by, review_note, reviewed_at` | Migration nyata: `user_id, status, note, created_at, updated_at` | Stale | `ARCHITECTURE.md:367-375` vs migration |
| ARCHITECTURE.md DDL tabel `dictionary` | Cocok persis migration nyata | Akurat | `ARCHITECTURE.md:589-618` |
| ARCHITECTURE.md §4.1 tidak mencantumkan DDL `word_reports` | Tabel ada penuh di migration `...000009` | Undocumented addition (bukan salah, belum dicatat) | grep tidak menemukan blok DDL di ARCHITECTURE.md §4.1 |
| **PRD.md OQ-04** "bahasa terjemahan: Indonesia/Inggris/keduanya" masih berstatus open question, meski PRD juga klaim "Fase 0 selesai, dataset siap pakai" | Data aktual `dictionary.translations` **100% bahasa Inggris**; tidak ada kolom/field Indonesia di seluruh codebase | **Stale/belum pernah diputuskan** — terkesan diam-diam "diputuskan" Inggris-saja tanpa update eksplisit | `PRD.md:80,275,465,1252` vs kode |
| PRD.md §21.2 audit findings soal `translations` (cleanup gloss) | Konsisten dengan `normalize_dictionary.py` | Akurat | `PRD.md:1472-1494` vs `scripts/normalize_dictionary.py:100-127` |

## 6. Relevant Constraints & Tech Debt

Ditulis khusus untuk konteks rencana fitur "terjemahan Indonesia" (delta berikutnya):

- **Kolom `translations` adalah single free-text**, dipakai di ≥10 titik render (`SearchBar.tsx:141`, `WordDetail.tsx:326,328,379`, `ArtikelRush.tsx:116,414`, `ReviewSession.tsx:554`, `AdminConsole.tsx`, `SuggestCorrection.tsx`) — menambah kolom baru berarti menyentuh banyak titik, bukan satu tempat.
- **Titik yang perlu disentuh kalau kolom bahasa baru ditambahkan**:
  1. Migration Postgres baru + `search_vector` generated column (butuh `DROP`+`ADD ulang`, tidak bisa `ALTER` in-place).
  2. Edge Function `dictionary-search/index.ts:56-65` — hardcode nama kolom.
  3. Dexie schema versi baru (`dictionaryDb.ts`) — riwayat migrasi Dexie sudah pernah gagal sekali (lihat §7).
  4. `searchService.ts` MiniSearch `fields`/`storeFields` (baris 18-19).
  5. `data-pipeline/` scripts (`normalize_dictionary.py`, `export_dictionary_full.py` kolom baris 44-48, `import_to_supabase.py`) — **sumber data Indonesia belum ada sama sekali** di `data-pipeline/raw/`.
  6. `AdminConsole.tsx:19,321` & `SuggestCorrection.tsx` hardcode daftar field yang bisa dikoreksi teacher.
- **Full re-download model**: seluruh dictionary (~110rb lemma) diunduh utuh tiap client; menambah kolom memperbesar file `dictionary-full.vN.json` dan memicu re-download semua client — tidak ada mekanisme delta/partial-column update.
- **Tidak ada automated test untuk data-pipeline Python** — regresi skema hanya kelihatan lewat `validate_dictionary.py` manual.

## 7. High-Risk Areas

- **`src/core/search/searchService.ts`** — logic tiering/ranking rumit, baru saja kena fix race condition (`95c3a44`). Menambah field pencarian baru berisiko mengulang bug interleaved `removeAll()`/`addAll()`.
- **`src/modules/admin/components/AdminConsole.tsx`** — file besar (>400 baris), **tanpa test**, menangani approve suggestion & apply correction ke production `dictionary`.
- **`src/modules/teacher/components/SuggestCorrection.tsx`** — tanpa test; skemanya (`dictionary_suggestions`) sudah terbukti sekali drift dari dokumentasi.
- **`data-pipeline/scripts/*.py`** — tanpa automated test, riwayat PRD §21.2 menunjukkan bug halus historis di sini (gloss salah terdeteksi, dsb).
- **Migration Supabase berulang kali nge-patch RLS/PK bolong** (`...000006,...000008,...000010/11/12/13`) — pola ship-dulu-patch-belakangan; perubahan skema `dictionary` baru harus lebih hati-hati soal RLS dari awal.
- **Dexie schema migration** (`dictionaryDb.ts`) — sudah pernah gagal sekali (ganti primary key `wordId`→`wordRef`, v4/v4.1) — area rawan human error kalau menambah/ubah index kolom dictionary.
