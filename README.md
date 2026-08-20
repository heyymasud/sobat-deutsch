# Sobat Deutsch

Aplikasi belajar kosakata dan tata bahasa Jerman: kamus offline-first, flashcard SRS (SM-2), kuis Artikel Rush, dan alur Teacher/Admin untuk kurasi data kamus.

Dokumen acuan lengkap ada di [`docs/`](docs/) — baca [CLAUDE.md](CLAUDE.md) untuk alur kerja dan mandat checklist proyek ini.

| Dokumen | Isi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Requirement produk (FR/BR/NFR/AC) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Desain teknis, skema DB, migration, API |
| [docs/SPRINT_PLAN.md](docs/SPRINT_PLAN.md) | Rencana eksekusi per sprint |
| [docs/SPRINT_CHECKLIST.md](docs/SPRINT_CHECKLIST.md) | Tracker progres live |

## Stack

- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS
- **Data lokal**: Dexie (IndexedDB) — kamus, deck, kartu SRS, antrean sync, jalan offline
- **Pencarian lokal**: MiniSearch di atas data kamus yang sudah diunduh
- **Backend**: Supabase (Postgres + Auth + Edge Functions + Storage), self-host lewat Supabase CLI — bukan server kustom
- **Test**: Vitest · **Lint**: Oxlint

## Menjalankan secara lokal

### Prasyarat

- Node.js
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (untuk menjalankan Supabase lokal)
- Supabase CLI (dipanggil via `npx supabase`, tidak perlu instalasi global)

### Setup

```bash
npm install
npx supabase start      # jalankan Postgres + Auth + Edge Functions + Storage lokal via Docker
```

Salin `.env.example` ke `.env.local` lalu isi `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` dengan output dari `npx supabase status` (untuk dev lokal, biasanya `http://127.0.0.1:54321` + anon key demo bawaan CLI).

```bash
npm run dev
```

App jalan di `http://localhost:5173` (default Vite).

### Catatan penting untuk testing lokal

- **Dictionary kosong secara default** di instance Supabase lokal yang baru. Kalau `data-pipeline/output/dictionary.sqlite` sudah ada (hasil pipeline yang sudah pernah jalan), tinggal import ke Postgres lokal:

  ```bash
  py scripts/import_to_supabase.py
  ```

  Kalau file itu belum ada sama sekali, harus generate dulu dari raw dump Wiktionary (`data-pipeline/raw/kaikki-german.jsonl`, ~1.1GB, tidak masuk git) lewat `scripts/normalize_dictionary.py` → `add_frequency.py` → `enrich_verb_grammar.py` → `verb_case_governance.py` → `assign_level_proxy.py`, baru `import_to_supabase.py` — proses ini berat dan sekali-jalan, bukan langkah rutin. Tanpa data kamus, fitur pencarian/kamus kosong, tapi Auth/SRS/Quiz/Admin tetap bisa dites.
- **Email verifikasi & reset password** lokal ditangkap Mailpit, bukan terkirim sungguhan: `http://127.0.0.1:54324`.
- **Supabase Studio** (lihat isi tabel, jalankan SQL manual) ada di `http://127.0.0.1:54323`.
- Kalau Docker/Supabase mati, jalankan ulang `npx supabase start` sebelum `npm run dev`.
- `npx supabase db reset --local` mengulang semua migration dari nol (berguna kalau skema berubah, tapi menghapus semua data lokal).

## Gate wajib sebelum menandai task selesai

Sesuai mandat di [CLAUDE.md](CLAUDE.md), keempat command ini wajib exit code 0:

```bash
npm run build       # tsc -b && vite build
npm run typecheck   # tsc --noEmit
npm run lint        # oxlint
npm run test        # vitest run
```

## Pipeline data kamus

`scripts/*.py` terpisah dari runtime app (tidak jalan saat build/deploy) — lihat [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §7.2/§21 untuk alur lengkap dari dump Wiktionary (kaikki.org) sampai tabel `dictionary` di Postgres. Setiap kali pipeline diubah, jalankan:

```bash
py scripts/validate_dictionary.py
```

harus tetap lolos sebelum perubahan dianggap aman.
