# Sobat Deutsch — Instruksi Proyek

## Dokumen acuan (baca sebelum mengerjakan apa pun)

| Dokumen | Isi | Kapan dibaca |
|---|---|---|
| [docs/PRD.md](docs/PRD.md) | Requirement (FR/BR/NFR/AC/EC/UF/OQ) — **WHAT** | Sebelum implementasi fitur apa pun |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Desain teknis, skema DB, migration, API contract — **HOW** | Sebelum menulis kode/migration |
| [docs/SPRINT_PLAN.md](docs/SPRINT_PLAN.md) | Backlog per sprint + traceability | Saat menentukan task berikutnya |
| [docs/SPRINT_CHECKLIST.md](docs/SPRINT_CHECKLIST.md) | **Tracker live progres task** | **Setiap sesi kerja — wajib** |

`SPRINT_PLAN.md` adalah rencana (jarang diubah). **Progres ditulis di `SPRINT_CHECKLIST.md`, bukan di sprint plan.**

---

## MANDAT CHECKLIST (WAJIB, tidak ada pengecualian)

Setiap sesi kerja implementasi WAJIB mengikuti alur ini:

1. **Sebelum mulai** — buka `docs/SPRINT_CHECKLIST.md`, tentukan task berikutnya sesuai urutan sprint dan dependency-nya. Tandai task yang diambil sebagai `[~]` (sedang dikerjakan).
2. **Selama mengerjakan** — hormati jalur kritis: Sprint 2 (Progressive Full Download) memblokir Sprint 3 dan seterusnya. Jangan lompat urutan tanpa konfirmasi user.
3. **Setelah selesai** — tandai `[x]` HANYA kalau seluruh gate di bawah lolos, DAN isi field `bukti:` dengan perintah yang dijalankan + hasilnya.
4. **Kalau ada gate gagal** — tandai `[!]` + tulis alasannya. **JANGAN tandai `[x]`.**

### Definition of DONE — semua wajib terpenuhi

Sebuah task hanya boleh ditandai `[x]` kalau **SEMUA** kondisi ini benar:

- [ ] **Semua gate command exit code 0** (build, typecheck, lint, test — lihat tabel gate di `SPRINT_CHECKLIST.md`)
- [ ] **Tidak ada error baru DAN tidak ada warning baru** dibandingkan kondisi sebelum task ini dikerjakan
- [ ] **Acceptance Criteria (`AC-*`) yang dirujuk task diverifikasi dengan DIJALANKAN** — bukan dibaca kodenya lalu disimpulkan "logikanya sudah benar"
- [ ] **Business Rules (`BR-*`) terkait tidak dilanggar** (mis. BR-SRS-04: tema tidak boleh jadi urutan belajar; BR-DICT-07: field NULL tidak boleh ditampilkan seolah lengkap)
- [ ] **RLS/keamanan aktif** untuk setiap tabel Supabase baru yang disentuh
- [ ] **Field `bukti:` di checklist sudah diisi** — perintah nyata + ringkasan hasil

"Kode sudah ditulis" **BUKAN** definisi selesai. "Sepertinya sudah jalan" **BUKAN** bukti.

### DILARANG

- ❌ Menandai `[x]` tanpa menjalankan gate. Klaim tanpa bukti = pelanggaran mandat ini.
- ❌ Melonggarkan gate supaya lolos: skip/disable test, matikan lint rule, `--no-verify`, ubah tipe jadi `any`, `@ts-ignore`, atau menaikkan threshold error. Gate gagal → **perbaiki akar masalahnya** atau tandai `[!]` blocked.
- ❌ Menulis progres/status di `SPRINT_PLAN.md` (itu dokumen rencana, bukan tracker).
- ❌ Menambah task baru ke checklist tanpa juga menambahkannya ke `SPRINT_PLAN.md` + Traceability Matrix-nya (mencegah drift antara rencana dan tracker).

### Catatan soal "tidak ada warning"

Aturannya adalah **tidak ada warning BARU**, bukan "nol warning di seluruh repo". Alasannya: repo bisa punya warning lama dari dependency pihak ketiga yang di luar kendali task ini — gate yang tidak mungkin dicapai justru memicu dua kegagalan: klaim "done" palsu, atau deadlock permanen. Kalau nanti proyek ini memang menegakkan zero-warning, update aturan ini di sini dan di `SPRINT_CHECKLIST.md`.

---

## Prinsip teknis yang mengikat

Diambil dari PRD/Architecture — jangan dilanggar tanpa update dokumennya dulu:

- **Local-first**: pencarian kamus, SRS, dan kuis berjalan di client. Server hanya auth, sinkronisasi progres, dan search untuk client yang belum selesai unduh (State A) — lihat ARCHITECTURE.md §1.2.
- **Data kamus read-only bagi pengguna** (BR-DICT-01). Koreksi hanya lewat alur Teacher → Admin approve (PRD §7.1a).
- **Field kosong tidak boleh ditampilkan seolah lengkap** (BR-DICT-07). Query fitur yang butuh gender/auxiliary wajib memfilter NULL.
- **Tidak pakai Docker, Redis, NestJS, atau self-hosted Postgres** — keputusan final dengan alasan tercatat di ARCHITECTURE.md §21.5 (PRD). Jangan menambahkan tanpa bottleneck terukur.
- **Pipeline data (`scripts/*.py`) terpisah dari runtime app** — tidak jalan saat build/deploy. `data-pipeline/raw/` dan `data-pipeline/output/` tidak masuk git (lihat `.gitignore`).
- **Regression test data**: setiap kali pipeline kamus diubah, jalankan `py scripts/validate_dictionary.py` — harus tetap 45/45 lolos sebelum perubahan dianggap aman.
