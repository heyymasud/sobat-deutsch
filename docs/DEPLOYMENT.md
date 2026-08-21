# Deployment Guide — Sobat Deutsch

Panduan deploy production: Supabase (backend) + Vercel (frontend). Pipeline data kamus (`scripts/*.py`) **bukan** bagian dari proses deploy — dijalankan manual, sekali-jalan, dari mesin dev.

## Status saat dokumen ini ditulis

- [x] Migration di `supabase/migrations` sudah di-push ke project Supabase production (`supabase db push`)
- [x] Edge Functions sudah di-deploy (`supabase functions deploy`)
- [ ] Data kamus belum diimpor ke Postgres production
- [ ] Frontend belum di-deploy ke Vercel

---

## 1. Supabase (backend) — sudah selesai

Sudah dikerjakan: `supabase link`, `supabase db push`, `supabase functions deploy`. Tidak perlu secret manual untuk functions karena `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` otomatis disediakan runtime Supabase.

Sisa yang wajib dicek sebelum lanjut:

- Dashboard → Authentication → Policies: pastikan tiap tabel baru punya RLS aktif (mandat [CLAUDE.md](../CLAUDE.md)).
- Dashboard → Settings → API: catat `Project URL` dan `anon public key` — dipakai di langkah 3.

## 2. Impor data kamus ke Postgres production

`data-pipeline/output/dictionary.sqlite` sudah ada hasil pipeline lokal (tidak masuk git, dan **tidak** dijalankan saat build/deploy — lihat [ARCHITECTURE.md](ARCHITECTURE.md) §7.2/§21). Ini sekali-jalan manual, bukan bagian CI/CD.

`scripts/import_to_supabase.py` sebelumnya hardcode target ke Postgres **lokal**. Sudah diubah supaya bisa diarahkan ke production lewat env var (default tetap lokal, jadi tidak mengganggu workflow dev yang sudah ada).

Ambil connection string production dari Dashboard → Settings → Database → Connection string (mode **Session pooler** atau direct connection, port biasanya `5432` atau `6543`), lalu:

```bash
# Windows PowerShell
$env:PG_HOST="db.<project-ref>.supabase.co"
$env:PG_PORT="5432"
$env:PG_USER="postgres"
$env:PG_PASSWORD="<database-password>"
$env:PG_DB="postgres"
py scripts/import_to_supabase.py
```

```bash
# bash
PG_HOST=db.<project-ref>.supabase.co PG_PORT=5432 PG_USER=postgres \
PG_PASSWORD=<database-password> PG_DB=postgres \
py scripts/import_to_supabase.py
```

Script ini **truncate** tabel `dictionary` lalu insert ulang semua baris dari SQLite — aman dijalankan berkali-kali (idempotent secara hasil akhir), tapi selama proses berjalan tabel `dictionary` production akan kosong sesaat. Jalankan di luar jam pakai aktif kalau sudah ada user.

Setelah selesai, jalankan regression test data pipeline (wajib per [CLAUDE.md](../CLAUDE.md)):

```bash
py scripts/validate_dictionary.py
```

Harus tetap 45/45 lolos.

## 3. Frontend — Vercel

1. Push repo ke GitHub/GitLab (kalau belum ada remote).
2. Import repo di [vercel.com/new](https://vercel.com/new). Vercel auto-detect Vite:
   - Build command: `npm run build`
   - Output directory: `dist`
3. Environment Variables (Project Settings → Environment Variables, isi untuk Production **dan** Preview):
   - `VITE_SUPABASE_URL` — dari Dashboard → Settings → API
   - `VITE_SUPABASE_ANON_KEY` — dari Dashboard → Settings → API
   - `VITE_SENTRY_DSN` — opsional, kosongkan kalau tidak pakai Sentry
   - **Jangan** set `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` di Vercel — itu khusus seeding lokal (`npm run seed:admin`), tidak boleh masuk client bundle.
4. `vercel.json` di root sudah menangani SPA rewrite (`react-router-dom` client-side routing) supaya refresh di sub-route tidak 404.
5. Deploy lewat dashboard, atau via CLI:

   ```bash
   npx vercel --prod
   ```

## 4. Setelah deploy

- Dashboard Supabase → Authentication → URL Configuration: tambahkan domain Vercel (`https://<app>.vercel.app`) ke **Site URL** dan **Redirect URLs**, kalau tidak, flow login/signup/reset-password akan redirect ke domain salah atau ditolak CORS.
- Smoke test manual di domain production:
  - Sign up / login
  - Search kamus (butuh data dari langkah 2)
  - Buat/review kartu SRS, cek sync indicator
  - Kuis Artikel Rush
  - Kalau ada akun admin: alur approve suggestion/application (Edge Functions `admin-review-*`)
- Kalau butuh akun admin di production: **tidak ada seeding otomatis di production** (`npm run seed:admin` cuma untuk lokal, connect ke Supabase lokal). Promosi role admin manual lewat SQL di Supabase Studio production, atau jalankan `seed_admin.mjs` dengan env yang diarahkan ke production project (cek isi script sebelum dipakai ke prod).

## Referensi terkait

- [ARCHITECTURE.md](ARCHITECTURE.md) §1.2 — local-first, kapan server dipanggil
- [ARCHITECTURE.md](ARCHITECTURE.md) §7.2/§21 — alur pipeline data kamus lengkap
- [../CLAUDE.md](../CLAUDE.md) — mandat checklist & prinsip teknis yang tidak boleh dilanggar
