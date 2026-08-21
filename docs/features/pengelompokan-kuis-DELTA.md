# Delta: Pengelompokan Kata untuk Kuis + Tips Prediksi Gender

> Versi: 1.0 — 2026-08-21
> Baseline acuan: `docs/CODEBASE_BASELINE.md` v1.0
> Sumber ide: `docs/SCRATCH_FEATURE_NOTES.md` §3

## 1. Feature Summary

ArtikelRush (`src/modules/quiz/components/ArtikelRush.tsx`) saat ini memilih kata secara acak murni dari kata benda yang lolos filter kualitas (`fetchNextWord()`, hanya di-weight oleh riwayat kesalahan lewat `mistakeTracker`) — tidak ada pengurutan dari gampang ke sulit, sehingga pemula bisa langsung ketemu kata jarang/sulit di awal.

Ditemukan juga masalah data: kolom `dictionary.level` berisi label `'A1'/'A2'/'B1'` yang ditampilkan di `WordDetail.tsx:205` dan `SearchBar.tsx:160` seolah itu level CEFR resmi — padahal itu cuma proxy dari `frequency_rank` (`scripts/assign_level_proxy.py`), bukan data CEFR asli (Goethe-Institut, dst). Ini **misleading** dan harus diperbaiki sebagai bagian delta ini, bukan ditunda.

Delta ini menambahkan:
1. Relabel tampilan `level` dari kode CEFR (`A1`/`A2`/`B1`) jadi label jujur berbasis frekuensi ("Sering dipakai"/"Menengah"/"Jarang dipakai") — di titik render, tanpa mengubah kolom database (`level` tetap `'A1'/'A2'/'B1'` sebagai kode tier internal; hanya interpretasinya yang diubah).
2. Difficulty tiering untuk ArtikelRush berbasis frequency rank (kata sering dipakai duluan).
3. Tier tambahan opsional: regularitas gender akhiran kata (kata dengan pola akhiran predictable = lebih gampang).
4. Tips gender kontekstual saat user salah jawab di ArtikelRush, memakai ulang rule yang SUDAH ADA di `WordDetail.tsx:111-117` (`genderClue`, FR-DICT-11/AC-DICT-06) — bukan duplikasi rule baru.

## 2. Conflict/Duplication Check

**Konflik ditemukan dan wajib dicatat (bukan diam-diam ditimpa):**
- **FR-DICT-10** ("Halaman detail menampilkan POS dan level kemampuan (A1–B1)") — wording requirement ini sendiri sudah mengasumsikan CEFR asli. Delta ini TIDAK mengubah teks FR-DICT-10 di `docs/PRD.md` (di luar scope delta untuk mengedit PRD lama), tapi menambahkan **BR-DICT-15** yang secara eksplisit mengklarifikasi bahwa label yang ditampilkan adalah tier frekuensi, bukan CEFR resmi — supaya interpretasi FR-DICT-10 ke depan mengikuti klarifikasi ini. **Rekomendasi terpisah (di luar scope delta)**: `docs/PRD.md` FR-DICT-10 sebaiknya di-audit/direvisi lewat `audit-docs-consistency` agar tidak terus mengklaim CEFR.
- **Rule gender clue TIDAK diduplikasi** — `genderClue` di `WordDetail.tsx:111-117` dipakai ulang (di-extract jadi fungsi shared), bukan ditulis ulang di `ArtikelRush.tsx`.

Tidak ada konflik lain dengan fitur yang sudah ada (SRS/sync/pipeline data tidak tersentuh).

## 3. New Requirements (FR/BR/NFR)

ID melanjutkan skema tertinggi yang sudah dipakai (termasuk delta `data-kaikki-tambahan-DELTA.md`): FR-DICT terakhir 20, BR-DICT terakhir 14, AC-DICT terakhir 15, EC-DICT terakhir 13, FR-QUIZ terakhir 11, BR-QUIZ terakhir 06, AC-QUIZ terakhir 07, EC-QUIZ terakhir 05.

| ID | Requirement | Priority |
|---|---|---|
| BR-DICT-15 | Label `level` (`A1`/`A2`/`B1`) yang ditampilkan ke user WAJIB diinterpretasikan & dilabel sebagai tier frekuensi pemakaian ("Sering dipakai"/"Menengah"/"Jarang dipakai"), TIDAK BOLEH diberi label atau framing yang menyiratkan itu level CEFR resmi — karena datanya adalah proxy dari `frequency_rank`, bukan wordlist CEFR bersertifikat |
| FR-DICT-21 | Halaman detail kata dan hasil pencarian menampilkan badge tier frekuensi dengan label jujur (bukan kode `A1`/`A2`/`B1` mentah) | Must |
| FR-QUIZ-12 | ArtikelRush memilih kata dengan bias ke tier frekuensi lebih sering dipakai di awal permainan/level rendah pengguna | Should |
| FR-QUIZ-13 | ArtikelRush menampilkan hint pola akhiran gender (reuse rule `genderClue`) sebagai feedback saat pengguna menjawab salah | Should |
| BR-QUIZ-07 | Hint gender di ArtikelRush hanya ditampilkan kalau rule pola akhiran benar-benar cocok (`genderClue` mengembalikan non-null) — TIDAK membuat clue baru yang tidak ada di rule existing (konsisten BR-DICT-05: jangan menyesatkan) |

## 4. Impact Analysis / Blast Radius

| Module/File | Jenis Perubahan | Risiko |
|---|---|---|
| `src/modules/dictionary/utils/genderClue.ts` (baru — hasil extract dari `WordDetail.tsx`) | Add — pindahkan fungsi `genderClue` jadi shared util | **Low** — pure function extraction, tidak mengubah behavior WordDetail |
| `src/modules/dictionary/components/WordDetail.tsx` | Modify — import dari util baru (bukan re-define), ganti render badge `level` mentah jadi label tier | **Low** — refactor minimal, AC-DICT-06 yang sudah ada tidak berubah perilakunya |
| `src/modules/dictionary/components/SearchBar.tsx` | Modify — ganti render badge `level` mentah jadi label tier | **Low** — isolasi render, tidak mengubah logic search |
| `src/modules/quiz/components/ArtikelRush.tsx` | Modify — `fetchNextWord()` tambah bias tier frekuensi ke pemilihan pool; `handleAnswer()` tampilkan hint gender saat salah | **Medium** — modul shared quiz, mengubah weighting existing pool selection (S5-02) yang sudah ada testnya (`ArtikelRush.test.ts`) |
| `supabase/migrations/*` | **Tidak ada** — TIDAK ada migration baru, kolom `level`/`frequency_rank` sudah ada dan tidak diubah nilainya | — |
| `scripts/*.py` | **Tidak disentuh** — proxy level tetap sama, ini murni perubahan interpretasi tampilan | — |

## 5. Migration Schema

**Tidak ada migration.** Delta ini tidak mengubah skema database — `level` dan `frequency_rank` sudah ada dan datanya tidak diubah. Perubahan murni di layer tampilan (label) dan logic aplikasi (weighting pool, hint kontekstual).

## 6. Compatibility Strategy

Tidak relevan — tidak ada perubahan API/kontrak data. Client lama dan baru membaca kolom `level`/`frequency_rank` yang sama; hanya cara frontend menampilkannya yang berubah, jadi tidak ada masalah kompatibilitas versi.

## 7. Rollback Plan / Feature Flag

- **Relabel tampilan**: rollback dengan mengembalikan render lama (`{entry.level}`) — perubahan murni di 2 file (`WordDetail.tsx`, `SearchBar.tsx`), reversible langsung tanpa efek data.
- **Difficulty tiering ArtikelRush (FR-QUIZ-12)**: risiko Medium (mengubah weighting pool existing) — kalau bermasalah, revert bagian bias tier di `fetchNextWord()` saja, weighting mistake-count (S5-02) yang sudah ada tetap jalan seperti semula karena logic-nya independen (ditambahkan, bukan menggantikan).
- **Hint gender kontekstual (FR-QUIZ-13)**: isolasi di `handleAnswer()` cabang `feedback === 'incorrect'` — bisa dimatikan dengan comment-out render hint tanpa mempengaruhi logic jawaban/scoring.

## 8. Impact on Tests/Regression

- `ArtikelRush.test.ts` (test yang sudah ada, S9-08 menambahkan 1 test bulk-add) — harus tetap lulus. Weighted pool selection (S5-02, mistake count) TIDAK BOLEH berubah perilakunya untuk kasus tanpa tier bias (test existing kemungkinan tidak set frequency_rank eksplisit — perlu dicek saat implementasi supaya tidak false-fail).
- `WordDetail.test.ts` — harus tetap lulus setelah extract `genderClue` jadi shared util; AC-DICT-06 (gender clue tampil untuk akhiran `-ung`) tidak boleh berubah hasilnya.
- Tidak ada High-Risk Area baseline yang tersentuh langsung (ArtikelRush/WordDetail tidak masuk daftar High-Risk baseline §7 — keduanya "Stable" dengan test).

## 9. Acceptance Criteria & Edge Cases

| ID | Given/When/Then |
|---|---|
| AC-DICT-16 | **Given** kata dengan `level = 'A1'`, **When** badge tier ditampilkan di halaman detail/hasil pencarian, **Then** label yang tampil adalah "Sering dipakai" (atau setara), bukan teks "A1" mentah |
| AC-QUIZ-08 | **Given** pengguna baru mulai sesi ArtikelRush, **When** kata-kata dipilih, **Then** kata dengan tier frekuensi lebih sering dipakai muncul dengan probabilitas lebih tinggi di awal sesi dibanding kata tier jarang dipakai |
| AC-QUIZ-09 | **Given** pengguna menjawab salah untuk kata benda yang akhirannya cocok rule gender (mis. `-ung`), **When** feedback salah ditampilkan, **Then** hint pola akhiran ditampilkan (reuse `genderClue`) |
| AC-QUIZ-10 | **Given** pengguna menjawab salah untuk kata yang akhirannya TIDAK cocok rule manapun, **When** feedback salah ditampilkan, **Then** TIDAK ada hint gender yang dipaksakan/salah ditampilkan |

| ID | Edge Case | Penanganan |
|---|---|---|
| EC-DICT-14 | Kata tanpa `level` (NULL, di luar top 6000 frequency_rank) | Badge tier tidak ditampilkan sama sekali (konsisten BR-DICT-04/07 — jangan tampilkan seolah ada data) |
| EC-QUIZ-06 | Pool kata hasil filter kualitas (S5-03) di suatu batch kebetulan semuanya tier "jarang dipakai" (mis. karena random offset) | Bias tier mempengaruhi PROBABILITAS pemilihan dalam pool yang tersedia, bukan hard-filter yang bisa menghasilkan pool kosong — kalau tidak ada kata tier "sering" di batch itu, tetap pilih dari yang ada (fallback existing `fetchNextWord()` recursive re-fetch kalau `filtered.length === 0` tidak berubah) |

## Handoff

Lanjut ke `plan-sprint` (brownfield mode). Sebelum implementasi: `audit-docs-consistency` (khusus cek FR-DICT-10 vs BR-DICT-15 baru — rekomendasi revisi FR-DICT-10 dicatat di §2, bukan otomatis dieksekusi delta ini). Setelah implementasi: `audit-implementation`.
