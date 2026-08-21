# Delta: Perbaikan UX SRS/Flashcard (Wording, Manajemen Kartu, Reset Progress)

> Versi: 1.0 — 2026-08-21
> Baseline acuan: `docs/CODEBASE_BASELINE.md` v1.0
> Sumber ide: `docs/SCRATCH_FEATURE_NOTES.md` §4

## 1. Feature Summary

Modul SRS (`src/modules/srs/*`, `src/core/srs/*`) stable secara algoritma (SM-2, well-tested) tapi ditemukan 5 gap UX/manajemen kartu lewat pemakaian langsung:

1. Wording rating kartu ("Lagi/Keras/Baik/Mudah") adalah terjemahan literal jargon Anki, membingungkan native speaker Indonesia.
2. Tidak bisa edit/hapus kartu individual di dalam deck (hanya bisa hapus SELURUH deck).
3. Tidak bisa browse/lihat isi deck di dalam app (satu-satunya cara sekarang lewat Ekspor CSV).
4. Tidak ada aksi "reset" progress deck (kembalikan interval/repetitions/easeFactor semua kartu ke kondisi baru TANPA menghapus kartunya).
5. Ekspor CSV — **diputuskan dihapus** (data mentah SM-2, tidak mudah dibaca, gunanya tidak jelas untuk user; kebutuhan "lihat isi deck" dipenuhi oleh gap #3 di atas, bukan file mentah).

## 2. Conflict/Duplication Check

**Tidak ada konflik ditemukan.** Kelima gap ini adalah penambahan/pengurangan fitur murni di `DeckManager.tsx`/`ReviewSession.tsx`, tidak tumpang tindih dengan requirement existing manapun di PRD. Tidak ada FR/BR yang mengklaim fitur-fitur ini sudah ada.

## 3. New Requirements (FR/BR/NFR)

ID melanjutkan skema tertinggi yang sudah dipakai: FR-SRS terakhir 18, BR-SRS terakhir 11, AC-SRS terakhir 11, EC-SRS terakhir 10.

| ID | Requirement | Priority |
|---|---|---|
| FR-SRS-19 | Rating kartu review menggunakan wording deskriptif bahasa Indonesia yang menjelaskan kondisi mengingat, bukan terjemahan literal jargon SM-2 (Again/Hard/Good/Easy) | Must |
| FR-SRS-20 | Pengguna dapat menghapus satu kartu tertentu dari dalam deck tanpa menghapus deck secara keseluruhan | Should |
| FR-SRS-21 | Pengguna dapat melihat/browse daftar kartu di dalam deck (lemma, jenis kartu, status jadwal) langsung di dalam aplikasi | Should |
| FR-SRS-22 | Pengguna dapat me-reset progress SEMUA kartu di suatu deck (interval/repetitions/easeFactor kembali ke kondisi baru) tanpa menghapus kartu-kartu itu | Should |
| BR-SRS-12 | Reset progress deck TIDAK PERNAH menghapus baris `srsCards` — hanya mengubah field penjadwalan (`interval`, `repetitions`, `easeFactor`, `dueDate`) kembali ke nilai awal (`interval: 0, easeFactor: 2.5, repetitions: 0, dueDate: now`), konsisten dengan nilai default di `generateCardsForWord` (`srsScheduler.ts`) |
| BR-SRS-13 | Ekspor CSV (`handleExportDeck` di `DeckManager.tsx`) dihapus dari UI dan tidak digantikan mekanisme ekspor lain di delta ini — kebutuhan "lihat isi data" dipenuhi FR-SRS-21 |

## 4. Impact Analysis / Blast Radius

| Module/File | Jenis Perubahan | Risiko |
|---|---|---|
| `src/modules/srs/components/ReviewSession.tsx` | Modify — ganti label tombol rating (baris 636-657), TIDAK mengubah value rating (1-4) yang dikirim ke `calculateSm2` | **Low** — perubahan teks murni, tidak menyentuh logic SM-2 |
| `src/modules/srs/components/DeckManager.tsx` | Modify — hapus `handleExportDeck` + tombol "Ekspor CSV"; tambah UI browse kartu per-deck (kemungkinan modal/expand row); tambah aksi hapus kartu individual; tambah aksi "Reset Progress" per deck | **Medium** — modul shared (deck CRUD), tapi perubahan additive/UI baru, tidak mengubah alur create/rename/delete deck yang sudah ada dan sudah dites |
| `src/core/db/dictionaryDb.ts` | **Tidak disentuh** — tidak ada perubahan skema, `srsCards` sudah punya semua field yang dibutuhkan (`interval`, `repetitions`, `easeFactor`, `dueDate`) | — |
| `supabase/migrations/*` | **Tidak ada migration baru** — reset progress adalah UPDATE ke field yang sudah ada, hapus kartu individual adalah DELETE row yang sudah didukung skema existing | — |
| `src/modules/srs/components/DeckManager.test.ts` (existing) | Modify — tambah test untuk reset progress, hapus kartu individual, browse deck; test `handleExportDeck` (jika ada) dihapus | **Low** — perluasan test, tidak mengubah assertion lama untuk create/rename/delete deck |

## 5. Migration Schema

**Tidak ada migration.** Semua field yang dibutuhkan (`interval`, `repetitions`, `easeFactor`, `dueDate` di `srsCards`) sudah ada di skema Dexie & Supabase. Reset progress dan hapus kartu individual adalah operasi UPDATE/DELETE murni terhadap data yang sudah ada, tanpa perubahan struktur tabel.

## 6. Compatibility Strategy

Tidak relevan — tidak ada perubahan kontrak data/API. Perubahan sinkronisasi (reset progress & hapus kartu individual perlu masuk `syncQueue` seperti mutasi kartu lain yang sudah ada, mengikuti pola `handleRating`/`handleSuspend` di `ReviewSession.tsx` yang sudah mengirim `updatedAt` lewat `syncEngine`).

## 7. Rollback Plan / Feature Flag

- **Wording rating**: rollback dengan mengembalikan label lama — perubahan teks murni, reversible instan, tidak ada data yang berubah.
- **Hapus kartu individual / Reset progress**: operasi ini **mengubah/menghapus data pengguna** — rollback KODE (revert komponen) tidak mengembalikan data yang sudah dihapus/direset. Mitigasi wajib: tombol kedua aksi ini WAJIB pakai konfirmasi eksplisit (`confirm()` dialog, konsisten pola `handleDeleteDeck` yang sudah ada) sebelum eksekusi — mencegah klik tidak sengaja, karena tidak ada undo setelah data berubah.
- **Hapus Ekspor CSV**: rollback dengan mengembalikan `handleExportDeck` + tombolnya dari git history — tidak ada efek data (CSV cuma read/export, bukan mutasi).

## 8. Impact on Tests/Regression

- `DeckManager.test.ts` (kalau sudah ada test untuk create/rename/delete deck) — harus tetap lulus tanpa modifikasi assertion lama; fungsi CRUD deck existing tidak boleh berubah perilakunya.
- `ReviewSession.tsx` tidak masuk daftar High-Risk baseline (Stable, ada test) — tapi wording rating menyentuh UI yang sering diinteraksi user, wajib dites visual manual minimal sekali sebelum rilis (tidak cukup hanya unit test label string).
- **Sinkronisasi**: reset progress & hapus kartu individual harus diverifikasi ikut masuk `syncQueue` dan tersinkron ke server (regression check terhadap `syncEngine.test.ts` yang sudah ada, S9-01/S9-02) — supaya konsisten di multi-device, bukan cuma berubah lokal.

## 9. Acceptance Criteria & Edge Cases

| ID | Given/When/Then |
|---|---|
| AC-SRS-12 | **Given** pengguna sedang review kartu, **When** 4 tombol rating ditampilkan, **Then** labelnya deskriptif bahasa Indonesia (bukan "Lagi/Keras/Baik/Mudah") dan tetap memicu `calculateSm2` dengan rating 1-4 yang sama seperti sebelumnya |
| AC-SRS-13 | **Given** pengguna membuka detail deck, **When** memilih "Hapus" pada satu kartu tertentu, **Then** konfirmasi ditampilkan dulu, lalu HANYA kartu itu yang terhapus dari deck (kartu lain tidak terpengaruh) |
| AC-SRS-14 | **Given** pengguna membuka detail deck, **When** melihat daftar kartu, **Then** tiap kartu menampilkan minimal lemma, jenis kartu (`cardType`), dan status jadwal (due/belum due) — tanpa perlu ekspor file apa pun |
| AC-SRS-15 | **Given** pengguna memilih "Reset Progress" pada suatu deck, **When** konfirmasi disetujui, **Then** semua kartu di deck itu kembali ke `interval=0, repetitions=0, easeFactor=2.5, dueDate=sekarang`, TANPA ada kartu yang terhapus |
| AC-SRS-16 | **Given** halaman DeckManager, **When** ditampilkan, **Then** tidak ada lagi tombol/opsi "Ekspor CSV" |

| ID | Edge Case | Penanganan |
|---|---|---|
| EC-SRS-11 | Pengguna reset progress deck yang sedang di tengah sesi review aktif (`ReviewSession.tsx` terbuka di tab/device lain) | Reset progress hanya boleh dipicu dari `DeckManager.tsx` (bukan saat sesi aktif); sesi yang sedang berjalan tetap memakai state yang sudah di-load sampai selesai/direfresh — tidak perlu penanganan real-time cross-tab untuk delta ini (di luar scope) |
| EC-SRS-12 | Hapus kartu individual yang sedang berada di antrean sesi review yang sedang berjalan | Konsisten dengan pola existing `handleSuspend` (kartu suspended tetap difilter dari antrean due) — kartu terhapus tidak lagi muncul di render berikutnya; tidak perlu penanganan khusus di luar filter existing |

## Handoff

Lanjut ke `plan-sprint` (brownfield mode). Setelah implementasi: `audit-implementation` untuk verifikasi kode sesuai FR-SRS-19/20/21/22 & AC di atas.
