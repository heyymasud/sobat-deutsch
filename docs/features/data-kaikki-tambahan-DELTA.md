# Delta: Data Tambahan dari Kaikki (IPA, Etymology, Hyphenations)

> Versi: 1.0 — 2026-08-21
> Baseline acuan: `docs/CODEBASE_BASELINE.md` v1.0
> Sumber ide: `docs/SCRATCH_FEATURE_NOTES.md` §2

## 1. Feature Summary

Pipeline kamus sekarang (`scripts/normalize_dictionary.py`) hanya mengekstrak `glosses` dan `examples` dari `senses[]` di raw data `data-pipeline/raw/kaikki-german.jsonl`. Audit lapangan (lihat baseline & scratch notes) menemukan 3 field tambahan di raw data yang sudah tersedia tapi belum dimanfaatkan, dengan coverage yang cukup untuk jadi fitur (dicek di sample ~20rb baris dari 373rb baris mentah):

1. **IPA** (`sounds.ipa`, ~22.6% coverage) — fonetik cara baca kata, pelengkap TTS yang sudah ada (`WordDetail.tsx:66-71`).
2. **Etymology** (`etymology_text`, ~21.2% coverage) — asal-usul kata, untuk trivia/mnemonic bantu mengingat.
3. **Hyphenations** (`hyphenations`, ~14% coverage) — pemisahan suku kata.

Ketiganya murni **field tampilan tambahan** di halaman detail kata (`WordDetail.tsx`) — tidak mengubah mekanisme pencarian, SRS, atau kuis. Karena coverage semuanya di bawah 25%, field ini **opsional per-kata** (tampil kalau ada datanya, disembunyikan kalau tidak — bukan "data tidak tersedia" yang mengganggu, karena ini bukan atribut wajib seperti gender/plural).

Diputuskan sebagai satu delta bundel (ketiganya lewat pipeline yang sama, `normalize_dictionary.py` → `export_dictionary_full.py` → Supabase → sync client), dengan tambahan scope: automated test untuk perubahan pipeline Python (baseline §6/§7 mencatat `data-pipeline/scripts/*.py` sebagai High-Risk Area — tanpa automated test, hanya gate manual `validate_dictionary.py`).

## 2. Conflict/Duplication Check

**Tidak ada konflik ditemukan.** Field `ipa`, `etymology`, `hyphenation` tidak ada di skema `dictionary` manapun (dicek ke `supabase/migrations/20260820000004_dictionary.sql` via baseline §3). Tidak tumpang tindih dengan fitur lain yang sudah ada:
- Bukan pengganti audio TTS yang sudah ada (`WordDetail.tsx:66-71`) — IPA melengkapi, bukan menggantikan.
- Bukan bagian dari `search_vector` — field ini tidak perlu dicari, hanya ditampilkan, jadi tidak menyentuh FTS/MiniSearch/Edge Function `dictionary-search`.
- Tidak menyentuh SRS/flashcard (`generateCardsForWord` di `srsScheduler.ts` tidak perlu tahu field ini untuk delta ini).

## 3. New Requirements (FR/BR/NFR)

ID melanjutkan skema existing di `docs/PRD.md` (FR-DICT terakhir: 17; BR-DICT terakhir: 12; AC-DICT terakhir: 10; EC-DICT terakhir: 10).

| ID | Requirement | Priority |
|---|---|---|
| FR-DICT-18 | Halaman detail kata menampilkan transkripsi fonetik IPA bila tersedia di data | Should |
| FR-DICT-19 | Halaman detail kata menampilkan info asal-usul kata (etymology) bila tersedia di data | Could |
| FR-DICT-20 | Halaman detail kata menampilkan pemisahan suku kata (hyphenation) bila tersedia di data | Could |
| BR-DICT-13 | Field IPA/etymology/hyphenation yang NULL tidak boleh ditampilkan sebagai section kosong atau "data tidak tersedia" — section itu disembunyikan total (konsisten prinsip BR-DICT-07, tapi field opsional non-inti tidak perlu penanda kosong yang mengganggu tampilan) |
| BR-DICT-14 | Teks `etymology_text` mentah dari Kaikki wajib melalui langkah pembersihan (strip markup/referensi teknis Wiktionary) di pipeline sebelum disimpan ke kolom `etymology` — tidak boleh ditampilkan mentah ke user |
| NFR-PERF-08 | Penambahan 3 kolom teks (IPA/etymology/hyphenation) tidak boleh menambah ukuran file `dictionary-full.vN.json` lebih dari 15% dari ukuran saat ini (mengacu NFR-REL-01/FR-DICT-02c soal model full re-download — kolom besar berisiko memperlambat unduhan awal) |
| NFR-MNT-05 | Perubahan `normalize_dictionary.py`/`export_dictionary_full.py` untuk delta ini disertai automated test (`scripts/test_normalize_dictionary.py` atau setara) yang memverifikasi fungsi ekstraksi IPA/etymology/hyphenation terhadap sample data tetap, dijalankan sebelum `validate_dictionary.py` manual (baseline §7: pipeline Python saat ini tanpa automated test — mitigasi risiko regresi diam-diam) |

## 4. Impact Analysis / Blast Radius

| Module/File | Jenis Perubahan | Risiko |
|---|---|---|
| `scripts/normalize_dictionary.py` | Modify — tambah `extract_ipa()`, `extract_etymology()`, `extract_hyphenation()` | **Medium** — modul shared, di High-Risk Area baseline (tanpa test sebelumnya; delta ini menambah test) |
| `scripts/export_dictionary_full.py` | Modify — tambah 3 kolom ke `columns` list | **Low** — perubahan isolasi, hanya nambah field ke list yang sudah ada |
| `scripts/test_normalize_dictionary.py` | Add (baru) | **Low** — kode baru, tidak menyentuh apa pun yang sudah berjalan |
| `supabase/migrations/<timestamp>_add_ipa_etymology_hyphenation.sql` | Add (baru) — `ALTER TABLE dictionary ADD COLUMN` x3, nullable | **Medium** — mengubah tabel `dictionary` yang sudah populated (110rb+ baris), tapi additive (kolom nullable, tidak ada data existing tersentuh) |
| `src/modules/dictionary/types.ts` | Modify — tambah 3 field opsional ke `DictionaryEntry` | **Low** — perluasan type, backward compatible (field baru nullable) |
| `src/core/db/dictionaryDb.ts` | Modify — Dexie schema version baru (v6) | **Medium** — baseline §7 mencatat riwayat migrasi Dexie pernah gagal sekali (primary key v4→v4.1); di sini hanya nambah field ke store yang ada, TIDAK mengubah primary key/index, jadi risiko lebih rendah dari kasus itu |
| `src/modules/dictionary/components/WordDetail.tsx` | Modify — tambah 3 section tampilan kondisional | **Low** — UI tambahan murni, tidak mengubah logic gender/plural/conjugation yang sudah ada |
| `src/core/search/searchService.ts` | **Tidak disentuh** | — |
| `supabase/functions/dictionary-search/index.ts` | **Tidak disentuh** | — |

## 5. Migration Schema

```sql
-- supabase/migrations/20260822000001_add_ipa_etymology_hyphenation.sql
-- Additive only: 3 kolom nullable baru, tidak ada data existing yang diubah/dihapus.

ALTER TABLE public.dictionary
  ADD COLUMN IF NOT EXISTS ipa text,
  ADD COLUMN IF NOT EXISTS etymology text,
  ADD COLUMN IF NOT EXISTS hyphenation text;

COMMENT ON COLUMN public.dictionary.ipa IS 'Transkripsi fonetik IPA dari Kaikki/Wiktionary, opsional (~22.6% coverage). FR-DICT-18.';
COMMENT ON COLUMN public.dictionary.etymology IS 'Asal-usul kata, sudah dibersihkan dari markup Wiktionary di pipeline. Opsional (~21.2% coverage). FR-DICT-19, BR-DICT-14.';
COMMENT ON COLUMN public.dictionary.hyphenation IS 'Pemisahan suku kata dipisah titik tengah (mis. "Hau·ser"), opsional (~14% coverage). FR-DICT-20.';

-- Tidak perlu ubah search_vector generated column -- field ini sengaja
-- TIDAK ikut FTS (BR di atas: hanya tampilan, bukan target pencarian).
```

**Catatan eksplisit**: migration ini TIDAK menghapus atau mengubah kolom existing manapun. Tidak menyentuh data 110rb+ baris yang sudah ada — kolom baru otomatis NULL untuk semua baris sampai re-export pipeline berikutnya mengisinya.

## 6. Compatibility Strategy

- **Client lama vs field baru**: karena model distribusi kamus adalah full re-download per `dictionary_meta.version` (bukan API incremental), tidak ada masalah kompatibilitas API — begitu `dictionary_meta.version` di-bump setelah pipeline re-export, SEMUA client (lama & baru) menerima file JSON baru yang sudah termasuk 3 kolom ini lewat mekanisme sync yang sudah ada (`FR-DICT-02c/d/e`, `syncManager.ts`) — tidak perlu logic kompatibilitas versi khusus.
- **Dexie lokal**: `dictionaryDb.ts` versi baru (v6) menambah field ke object store `dictionary`/`dictionaryStaging` — Dexie akan menjalankan upgrade otomatis untuk user yang sudah punya data lokal versi sebelumnya (field baru simply `undefined` sampai sync berikutnya mengisi, konsisten dengan pola field lain yang nullable).
- **Edge Function `dictionary-search`**: tidak diubah — tetap mengembalikan field yang sama seperti sekarang (State A/online search tidak butuh IPA/etymology/hyphenation, itu hanya muncul di halaman detail yang query dari data lokal/full row).

## 7. Rollback Plan / Feature Flag

- **Rollback skema**: karena migration ini cuma `ADD COLUMN` nullable, rollback aman lewat migration baru `DROP COLUMN IF EXISTS` tanpa efek ke data lain — tidak perlu deprecation period (tidak ada consumer lain yang depend ke 3 kolom baru ini di rilis pertama).
- **Rollback UI**: 3 section di `WordDetail.tsx` dirender kondisional (`entry.ipa && <IpaSection />`, dst) — kalau mau dimatikan sementara tanpa rollback DB, cukup comment-out render section-nya (bukan feature flag formal, karena risiko fitur ini Low-Medium, di bawah threshold "Medium/High" yang skill ini mensyaratkan feature flag wajib — tapi tetap mudah dimatikan karena isolasi render kondisional).
- **Rollback pipeline**: `extract_ipa/etymology/hyphenation` adalah fungsi baru murni (tidak mengubah fungsi extract lain yang sudah ada) — kalau bermasalah, cukup revert panggilan fungsinya di `run()`, kolom di DB tetap NULL, tidak mempengaruhi kolom lain.

## 8. Impact on Tests/Regression

Dari baseline §7 (High-Risk Areas) yang relevan ke delta ini:
- **`data-pipeline/scripts/*.py` tanpa automated test** — delta ini WAJIB menambah `scripts/test_normalize_dictionary.py` (NFR-MNT-05) yang menguji `extract_ipa()`, `extract_etymology()`, `extract_hyphenation()` terhadap sample entri raw Kaikki tetap (fixture), dijalankan sebelum gate manual `validate_dictionary.py` yang sudah ada — supaya regresi di 3 fungsi baru ini tidak lolos diam-diam seperti riwayat bug lain di pipeline ini (§21.2 PRD).
- **Dexie schema migration** (`dictionaryDb.ts`) — baseline mencatat riwayat gagal migrasi primary key (v4→v4.1). Delta ini HANYA menambah field ke store yang sudah ada (bukan mengubah primary key/index), tapi tetap wajib dites manual: buka app dengan data lokal versi lama, pastikan upgrade Dexie ke v6 berjalan tanpa error sebelum rilis.
- **Regression check existing**: `WordDetail.test.ts` (test UI yang sudah ada) harus tetap lulus tanpa modifikasi assertion lama — section baru ditambahkan, bukan mengubah section yang sudah dites.
- **`validate_dictionary.py` (45/45 ground truth)** — harus tetap 45/45 lolos setelah perubahan pipeline (mandat CLAUDE.md project), dijalankan sebagai gate akhir sebelum re-export.

## 9. Acceptance Criteria & Edge Cases

| ID | Given/When/Then |
|---|---|
| AC-DICT-11 | **Given** kata dengan data IPA tersedia, **When** halaman detail dibuka, **Then** transkripsi IPA ditampilkan berdampingan dengan tombol TTS |
| AC-DICT-12 | **Given** kata TANPA data IPA, **When** halaman detail dibuka, **Then** section IPA tidak ditampilkan sama sekali (bukan placeholder kosong) |
| AC-DICT-13 | **Given** kata dengan data etymology tersedia, **When** halaman detail dibuka, **Then** teks etymology yang sudah dibersihkan (tanpa markup Wiktionary mentah) ditampilkan di section terpisah |
| AC-DICT-14 | **Given** kata dengan data hyphenation tersedia, **When** halaman detail dibuka, **Then** pemisahan suku kata ditampilkan dengan separator visual jelas (mis. titik tengah) |
| AC-DICT-15 | **Given** pipeline dijalankan ulang dengan perubahan `normalize_dictionary.py`, **When** `scripts/test_normalize_dictionary.py` dijalankan, **Then** semua assertion ekstraksi IPA/etymology/hyphenation lulus sebelum lanjut ke `validate_dictionary.py` |

| ID | Edge Case | Penanganan |
|---|---|---|
| EC-DICT-11 | `etymology_text` mentah mengandung markup/referensi teknis Wiktionary (mis. notasi Proto-Indo-European, link internal) | Dibersihkan di pipeline (`BR-DICT-14`) sebelum disimpan; kalau pembersihan gagal/hasil tidak yakin bersih, field disimpan NULL (fallback aman) bukan menampilkan teks kotor |
| EC-DICT-12 | Field `hyphenations` di raw Kaikki punya >1 varian pemisahan (kadang ada beberapa opsi silabifikasi) | Ambil varian pertama saja (konsisten dengan pola `extract_translations`/`extract_example` yang sudah ada — ambil representatif pertama, bukan menggabung semua) |
| EC-DICT-13 | Ukuran file `dictionary-full.vN.json` bertambah signifikan setelah 3 kolom baru diisi | Diukur terhadap NFR-PERF-08 (maks +15%) sebelum rilis; kalau terlampaui, evaluasi ulang apakah etymology (field terpanjang) perlu dipotong/di-truncate |

## Handoff

Lanjut ke `plan-sprint` (brownfield mode, pakai delta ini sebagai requirement source) untuk breakdown task. Sebelum implementasi: jalankan `audit-docs-consistency` untuk cek delta ini konsisten dengan baseline & PRD. Setelah implementasi: `audit-implementation` (verifikasi kode sesuai FR-DICT-18/19/20 & AC di atas), plus `audit-domain-expert` untuk kualitas hasil pembersihan teks etymology (domain: linguistik Jerman) sebelum dianggap selesai.
