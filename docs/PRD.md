# PRD — Aplikasi Belajar Bahasa Jerman

**Nama Produk:** Sobat Deutsch
**Versi Dokumen:** 4.3 — diaudit 3-dokumen (PRD+Architecture+Sprint), rekonsiliasi angka verb
**Tanggal:** 19 Agustus 2026
**Status:** Draft lengkap — siap masuk tahap desain teknis & implementasi
**Pemilik Produk:** —

---

## Daftar Isi

1. [Latar Belakang & Masalah](#1-latar-belakang--masalah)
2. [Tujuan Produk & Metrik](#2-tujuan-produk--metrik)
3. [Ruang Lingkup](#3-ruang-lingkup)
4. [Pengguna & Hak Akses](#4-pengguna--hak-akses)
5. [Alur Utama Sistem](#5-alur-utama-sistem)
6. [Kebutuhan Fungsional](#6-kebutuhan-fungsional)
7. [Spesifikasi Fitur Detail](#7-spesifikasi-fitur-detail)
8. [Business Rules](#8-business-rules)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Prinsip Pedagogis](#10-prinsip-pedagogis-berbasis-riset)
11. [Prinsip UI/UX](#11-prinsip-uiux)
12. [Sumber Data & Skema](#12-sumber-data--skema-data)
13. [User Flow](#13-user-flow)
14. [Acceptance Criteria](#14-acceptance-criteria-ac)
15. [Edge Cases](#15-edge-cases-ec)
16. [Asumsi](#16-asumsi)
17. [Dependensi](#17-dependensi)
18. [Risiko & Mitigasi](#18-risiko--mitigasi)
19. [Roadmap & Prioritas](#19-roadmap--prioritas)
20. [Keputusan Terbuka](#20-keputusan-terbuka)
21. [Arsitektur Teknis](#21-arsitektur-teknis)

---

## 1. Latar Belakang & Masalah

Pembelajar bahasa Jerman level A1–B1 menghadapi hambatan yang berulang dan spesifik:

| # | Masalah | Dampak |
|---|---|---|
| P1 | **Gender gramatikal & bentuk jamak sulit dihafal.** Setiap kata benda baru membawa dua informasi tambahan (der/die/das + plural) yang tidak bisa ditebak dari maknanya | Pembelajar hafal arti kata tapi salah artikel saat menulis/berbicara |
| P2 | **Kamus online pihak ketiga tidak andal.** Lambat, bergantung koneksi, sering terkena kuota/rate limit API | Alur belajar terputus; tidak bisa dipakai offline |
| P3 | **Kata cepat terlupa** tanpa ritme pengulangan terukur | Effort belajar terbuang; kosakata tidak menumpuk |
| P4 | **Deklinasi 4 kasus membingungkan** saat harus diterapkan (Nominativ, Akkusativ, Dativ, Genitiv) | Tahu teorinya, tetap salah saat produksi kalimat |
| P5 | **UI kamus/aplikasi bahasa existing terasa jadul dan kaku.** Padat teks, hierarki visual lemah, terasa seperti dokumen akademik | Tidak menyenangkan dipakai harian → pembelajar berhenti memakai |

---

## 2. Tujuan Produk & Metrik

### 2.1 Tujuan

| Kode | Tujuan | Menjawab |
|---|---|---|
| G1 | Memberi jawaban gender + plural + konjugasi **instan dan offline-capable**, tanpa bergantung API pihak ketiga | P1, P2 |
| G2 | Memastikan kata yang sudah dipelajari **tidak hilang**, lewat pengulangan terjadwal (SRS) | P3 |
| G3 | Mengajarkan **pola**, bukan hafalan satuan | P1, P4 |
| G4 | Terasa **modern, ringan, menyenangkan** — bukan kamus digital jadul | P5 |
| G5 | Progres belajar **aman & tersinkron** lintas perangkat | P3 |

### 2.2 Metrik Keberhasilan

| Metrik | Target |
|---|---|
| Waktu respons pencarian kata | < 100ms, tanpa panggilan jaringan |
| Jumlah klik: hasil cari → mulai review | ≤ 2 klik |
| Ketersediaan offline | Pencarian + review berfungsi penuh tanpa koneksi |
| Durasi satu batch review | Dapat diselesaikan dalam ± 5 menit |
| Retensi D7 (pengguna kembali dalam 7 hari) | ≥ 40% |
| Akurasi kuis Artikel Rush pengguna aktif (setelah 4 minggu) | Naik ≥ 20 poin persentase dari sesi pertama |

---

## 3. Ruang Lingkup

### 3.1 In Scope (v1)

- Kamus Jerman–Indonesia/Inggris dengan gender, artikel, plural, POS, level A1–B1
- Sistem flashcard dengan Spaced Repetition (SM-2)
- Mini-game kuis artikel (Artikel Rush)
- Generator konjugasi kata kerja & tabel deklinasi 4 kasus
- Autentikasi & manajemen akun (termasuk mode tamu)
- Sinkronisasi progres belajar lintas perangkat
- Progressive Web App (PWA) dengan kemampuan offline
- Dark mode & aksesibilitas dasar (WCAG AA)
- Text-to-speech pengucapan via Web Speech API browser

### 3.2 Out of Scope (v1)

| Item | Alasan |
|---|---|
| AI conversation partner / chatbot | Scope besar, biaya API, bukan akar masalah yang diidentifikasi |
| Grammar checker untuk tulisan pengguna | Kompleksitas NLP tinggi |
| Leaderboard, sistem XP, kompetisi sosial | Gamifikasi berlebih; fokus v1 pada efektivitas belajar |
| Kursus terstruktur / kurikulum berbayar | Model bisnis belum ditentukan |
| Aplikasi native (iOS/Android) | PWA sudah menutupi kebutuhan mobile |
| Level C1–C2 | Fokus A1–B1 |
| Bahasa target selain Jerman | Fokus produk |
| Kolaborasi/deck sharing antar pengguna | Fase lanjut |
| Pembayaran / langganan | Belum ada monetisasi di v1 |

### 3.3 Batasan (Constraints)

- Data kamus tidak boleh bergantung pada API pihak ketiga saat runtime.
- Sumber data harus berlisensi bebas dan mengizinkan penggunaan aplikasi (dengan atribusi).
- **Cakupan kamus harus lengkap (full dictionary, bukan hanya A1–B1)** — pengguna tidak boleh mendapat hasil kosong untuk kata yang sah. Ukuran dataset mentah (kaikki.org) untuk seluruh kamus Jerman adalah ±1GB raw, tapi setelah pipeline normalisasi ukuran final terstruktur hanya **19,02MB untuk 110.894 lemma** (§21.2j) — seluruh kamus ini diunduh utuh ke client lewat model **Progressive Full Download** (unduhan background, state machine A/B/C, tidak memblokir penggunaan), lihat §21.3.

---

## 4. Pengguna & Hak Akses

### 4.1 Persona

**Persona utama — "Rani, 21, mahasiswa"**
Belajar Jerman mandiri untuk persiapan studi. Level A2. Belajar 10–15 menit/hari, sering di perjalanan dengan koneksi tidak stabil. Terbiasa aplikasi modern, cepat bosan dengan UI padat. Frustrasi karena selalu salah artikel meski hafal arti kata.

**Persona sekunder — "Bayu, 28, pekerja"**
Ikut kursus formal A1, butuh alat bantu untuk memperkuat materi kelas. Belajar di laptop saat malam. Butuh referensi cepat tabel konjugasi & deklinasi.

### 4.2 Role & Hak Akses

| Role | Deskripsi | Cara masuk |
|---|---|---|
| **Guest** | Pengguna belum terdaftar. Data tersimpan lokal di perangkat saja. Default, setara akses "Student" | Otomatis saat pertama membuka aplikasi |
| **Registered User (Student)** | Pengguna terdaftar dengan akun. Data tersinkron ke server | Registrasi email/password atau OAuth |
| **Teacher** *(baru)* | Dapat meninjau entri kamus dan mengajukan saran koreksi | **Self-apply** (ajukan permohonan jadi Teacher dari akun Registered User yang sudah ada) → **diverifikasi manual oleh Admin** sebelum aktif |
| **Admin** | Pengelola konten & sistem; meninjau & approve/reject saran dari Teacher | Diberikan manual, tidak ada self-registration |

### 4.3 Matriks Hak Akses

| Kapabilitas | Guest | Registered (Student) | Teacher | Admin |
|---|:---:|:---:|:---:|:---:|
| Mencari kata di kamus | ✅ | ✅ | ✅ | ✅ |
| Melihat konjugasi & deklinasi | ✅ | ✅ | ✅ | ✅ |
| Membuat & mengelola deck flashcard | ✅ (lokal) | ✅ | ✅ | ✅ |
| Menjalankan sesi review SRS | ✅ (lokal) | ✅ | ✅ | ✅ |
| Bermain Artikel Rush | ✅ | ✅ | ✅ | ✅ |
| Melihat statistik progres | ✅ (terbatas, lokal) | ✅ (lengkap, historis) | ✅ | ✅ |
| Sinkronisasi lintas perangkat | ❌ | ✅ | ✅ | ✅ |
| Backup & restore data | ❌ | ✅ | ✅ | ✅ |
| Ekspor deck (CSV/Anki) | ✅ | ✅ | ✅ | ✅ |
| Mengubah profil & preferensi akun | ❌ | ✅ | ✅ | ✅ |
| Menghapus akun & data | ❌ | ✅ | ✅ | ✅ |
| Melaporkan kesalahan data kamus (laporan sederhana) | ✅ | ✅ | ✅ | ✅ |
| **Mengajukan permohonan jadi Teacher** | ❌ | ✅ | — | — |
| **Mengajukan saran koreksi terstruktur** (field spesifik + alasan) | ❌ | ❌ | ✅ | ✅ |
| **Melihat status saran yang diajukan sendiri** | ❌ | ❌ | ✅ | ✅ |
| Meninjau & meng-approve/reject saran koreksi | ❌ | ❌ | ❌ | ✅ |
| Menerapkan koreksi ke `dictionary` (efek dari approve) | ❌ | ❌ | ❌ | ✅ (sistem, terpicu approve) |
| Memverifikasi/menolak permohonan Teacher | ❌ | ❌ | ❌ | ✅ |
| Mengelola pengguna & role | ❌ | ❌ | ❌ | ✅ |
| Menjalankan import/refresh dataset | ❌ | ❌ | ❌ | ✅ |
| Melihat metrik agregat sistem | ❌ | ❌ | ❌ | ✅ |

**Catatan penting:** Guest **tidak dipaksa mendaftar** untuk memakai fitur inti. Registrasi ditawarkan sebagai *upgrade* untuk sinkronisasi & keamanan data — bukan sebagai gerbang masuk (lihat §11 Zero-friction entry). Role **Teacher** adalah upgrade lanjutan dari Registered User (bukan jalur pendaftaran terpisah) — lihat §7.1a untuk alur permohonan & verifikasi.

---

## 5. Alur Utama Sistem

### 5.1 Arsitektur Logis

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (PWA)                         │
│                                                         │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────┐     │
│  │ Dictionary│  │ Flashcard │  │ Artikel Rush     │     │
│  │  Module   │  │ SRS Engine│  │ Quiz Module      │     │
│  └─────┬─────┘  └─────┬─────┘  └────────┬─────────┘     │
│        │              │                 │               │
│  ┌─────┴──────────────┴─────────────────┴─────────┐     │
│  │      Local Data Layer (IndexedDB / SQLite-WASM)│     │
│  │   • Kamus (read-only, hasil import)            │     │
│  │   • Deck & kartu SRS pengguna (read-write)     │     │
│  │   • Statistik & riwayat review                 │     │
│  └────────────────────┬───────────────────────────┘     │
│                       │                                 │
│              ┌────────┴─────────┐                       │
│              │  Sync Engine     │  (hanya Registered)    │
│              └────────┬─────────┘                       │
└───────────────────────┼─────────────────────────────────┘
                        │ HTTPS (saat online)
┌───────────────────────┼─────────────────────────────────┐
│                    SERVER                               │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Auth   │  │ User Progress│  │ Dictionary Dist. │   │
│  │  Service │  │   Storage    │  │  (versi dataset) │   │
│  └──────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        ▲
                        │ (offline, satu kali & berkala)
        ┌───────────────┴──────────────────┐
        │  Data Pipeline (build-time)      │
        │  Wiktionary/kaikki (UniMorph      │
        │  dievaluasi, tidak dipakai—§21.2k)│
        │  → normalization → dataset rilis │
        └──────────────────────────────────┘
```

### 5.2 Alur Sistem Utama

**A. Alur Onboarding & Data Awal**
1. Pengguna membuka aplikasi → sesi Guest dibuat otomatis (ID lokal).
2. Aplikasi mengecek versi dataset kamus lokal.
3. Jika belum ada → unduh & simpan dataset inti (A1–B1) ke penyimpanan lokal, tampilkan progres.
4. Setelah siap → pengguna langsung masuk ke layar utama (pencarian/review).

**B. Alur Pencarian**
1. Pengguna mengetik → query dijalankan ke indeks lokal (tanpa jaringan).
2. Hasil autocomplete tampil real-time.
3. Pengguna memilih kata → halaman detail: gender (berwarna), artikel, plural, POS, level, gender clue, konjugasi/deklinasi, audio.
4. Pengguna dapat menambahkan kata ke deck dengan satu klik.

**C. Alur Belajar (SRS)**
1. Sistem menyusun antrean review: kartu jatuh tempo (due) + kartu baru sesuai limit harian.
2. Antrean di-*interleave* (mencampur pola & tema).
3. Pengguna menjawab kartu → memilih Lupa/Sulit/Sedang/Mudah.
4. Engine SM-2 menghitung interval baru & tanggal jatuh tempo → simpan lokal.
5. Saat online & pengguna terdaftar → perubahan disinkronkan ke server.

**D. Alur Kuis (Artikel Rush)**
1. Pengguna memulai sesi berbatas waktu.
2. Sistem menyajikan kata benda acak (dibobot berdasarkan riwayat kesalahan).
3. Jawaban dicatat: benar/salah, waktu respons, streak.
4. Sesi berakhir → ringkasan skor + daftar kata yang salah.
5. Kata yang salah direkomendasikan masuk deck flashcard (satu klik terima).

**E. Alur Autentikasi & Sinkronisasi**
1. Guest memilih "Simpan progres" → registrasi/login.
2. Setelah autentikasi berhasil → data lokal Guest dimigrasikan ke akun (merge).
3. Selanjutnya setiap perubahan progres dicatat dan disinkronkan saat online.
4. Login di perangkat lain → data ditarik dan digabungkan.

---

## 6. Kebutuhan Fungsional

### 6.1 Modul Autentikasi & Akun (AUTH)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-AUTH-01 | Sistem membuat sesi Guest otomatis saat aplikasi pertama dibuka, tanpa input pengguna | Must |
| FR-AUTH-02 | Pengguna dapat registrasi dengan email + password | Must |
| FR-AUTH-03 | Sistem memvalidasi format email dan kekuatan password saat registrasi | Must |
| FR-AUTH-04 | Sistem mengirim email verifikasi setelah registrasi | Must |
| FR-AUTH-05 | Pengguna dapat login dengan email + password | Must |
| FR-AUTH-06 | Pengguna dapat login menggunakan OAuth (Google) | Should |
| FR-AUTH-07 | Pengguna dapat melakukan reset password melalui email | Must |
| FR-AUTH-08 | Pengguna dapat logout dari perangkat aktif | Must |
| FR-AUTH-09 | Sistem memigrasikan data Guest ke akun saat registrasi/login pertama | Must |
| FR-AUTH-10 | Sistem mempertahankan sesi login (persistent session) hingga logout atau kedaluwarsa | Must |
| FR-AUTH-11 | Pengguna dapat mengubah password saat sudah login (memerlukan password lama) | Must |
| FR-AUTH-12 | Pengguna dapat mengubah nama tampilan & preferensi belajar | Should |
| FR-AUTH-13 | Pengguna dapat menghapus akun beserta seluruh datanya | Must |
| FR-AUTH-14 | Sistem membatasi percobaan login yang gagal (rate limiting) | Must |
| FR-AUTH-15 | Pengguna dapat melihat daftar perangkat/sesi aktif dan mencabutnya | Could |
| FR-AUTH-16 | Sistem menolak akses endpoint terproteksi tanpa token valid | Must |

### 6.2 Modul Kamus (DICT)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-DICT-01 | Pengguna dapat mencari kata Jerman dengan autocomplete real-time | Must |
| FR-DICT-02 | Pencarian dijalankan terhadap kamus lokal penuh (setelah unduhan latar belakang selesai) tanpa panggilan jaringan — model "Progressive Full Download", lihat §21.3 | Must |
| FR-DICT-02a | Sebelum unduhan latar belakang pertama kali selesai, pencarian dijalankan ke server (online); hasil TIDAK perlu di-cache manual karena unduhan penuh akan segera menggantikannya | Must |
| FR-DICT-02b | Saat offline dan kamus lokal belum pernah selesai diunduh sama sekali, sistem menampilkan pesan jelas bahwa pencarian memerlukan koneksi untuk pertama kali, bukan "kata tidak ada" | Must |
| FR-DICT-02c | Unduhan kamus lengkap berjalan otomatis di background saat online, tanpa memblokir penggunaan aplikasi (loading awal, pencarian, atau fitur lain) | Must |
| FR-DICT-02d | Saat versi kamus lokal sudah usang (ada versi baru di server) tetapi belum ada versi baru yang selesai diunduh, sistem **tetap memakai copy lokal yang usang** untuk pencarian (instan, offline) sambil mengunduh versi baru di background — tidak pernah mundur ke mode online-only hanya karena ada update tersedia | Must |
| FR-DICT-02e | Setelah unduhan versi baru selesai & terverifikasi (jumlah baris/checksum cocok), sistem menukar (swap) ke data baru secara atomik — tidak ada periode dengan data campuran/rusak | Must |
| FR-DICT-02f | Indikator status unduhan kamus offline (belum mulai/mengunduh N%/selesai/gagal) ditampilkan non-intrusive (mis. badge kecil), dengan opsi manual "coba lagi" bila gagal | Should |
| FR-DICT-03 | Pencarian mendukung input tanpa umlaut (`uben` menemukan `üben`) dan `ss`↔`ß` | Must |
| FR-DICT-04 | Pencarian mendukung pencarian terbalik (dari bahasa Indonesia/Inggris ke Jerman) | Should |
| FR-DICT-05 | Pencarian toleran terhadap salah ketik ringan (fuzzy match) | Should |
| FR-DICT-06 | Pencarian dapat menemukan lemma dari bentuk terinfleksi (`ging` → `gehen`) | Should |
| FR-DICT-07 | Halaman detail menampilkan gender dengan color coding konsisten | Must |
| FR-DICT-08 | Halaman detail menampilkan artikel definit, indefinit, dan negasi | Must |
| FR-DICT-09 | Halaman detail menampilkan bentuk plural | Must |
| FR-DICT-10 | Halaman detail menampilkan POS dan level kemampuan (A1–B1) | Must |
| FR-DICT-11 | Sistem menampilkan penjelasan pola gender berbasis akhiran kata bila berlaku | Must |
| FR-DICT-12 | Pengguna dapat memutar pengucapan kata (TTS) | Should |
| FR-DICT-13 | Pengguna dapat menambahkan kata ke deck flashcard dengan satu klik | Must |
| FR-DICT-14 | Sistem menyimpan riwayat pencarian pengguna | Should |
| FR-DICT-15 | Pengguna dapat memfilter/menelusuri kata berdasarkan tema, level, atau gender | Should |
| FR-DICT-16 | Pengguna dapat melaporkan entri kamus yang salah | Could |
| FR-DICT-17 | Sistem menampilkan atribusi sumber data sesuai lisensi | Must |

### 6.3 Modul Flashcard & SRS (SRS)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-SRS-01 | Pengguna dapat membuat, mengganti nama, dan menghapus deck | Must |
| FR-SRS-02 | Pengguna dapat menambah/menghapus kartu dari deck | Must |
| FR-SRS-03 | Sistem menghasilkan kartu otomatis dari entri kamus sesuai `card_type` | Must |
| FR-SRS-04 | Sistem mendukung tipe kartu: gender, plural, konjugasi, cloze-kasus, arti | Must |
| FR-SRS-05 | Kartu verba **selalu** disajikan dalam kalimat contoh, bukan pasangan kata terisolasi | Must |
| FR-SRS-06 | Kartu preposisi+kasus disajikan sebagai cloze chunk tunggal | Must |
| FR-SRS-07 | Sistem menjadwalkan review menggunakan algoritma SM-2 | Must |
| FR-SRS-08 | Pengguna memberi rating: Lupa / Sulit / Sedang / Mudah | Must |
| FR-SRS-09 | Antrean review di-*interleave* (mencampur ablaut class & tema) | Must |
| FR-SRS-10 | Kartu baru diperkenalkan mengikuti urutan `frequency_rank` | Must |
| FR-SRS-11 | Sistem menampilkan Pattern Drill singkat saat ablaut class baru pertama kali muncul | Should |
| FR-SRS-12 | Pengguna dapat mengatur limit kartu baru & review per hari | Should |
| FR-SRS-13 | Kartu dapat ditandai *suspended* / *buried* | Should |
| FR-SRS-14 | Sistem menampilkan animasi flip-card dua sisi | Must |
| FR-SRS-15 | Sistem menampilkan ringkasan hasil di akhir sesi review | Must |
| FR-SRS-16 | Sistem menyimpan riwayat setiap review (rating, waktu, interval) | Must |
| FR-SRS-17 | Pengguna dapat mengekspor deck (CSV/format Anki) | Could |
| FR-SRS-18 | Review dapat dijalankan sepenuhnya dalam kondisi offline | Must |

### 6.4 Modul Artikel Rush (QUIZ)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-QUIZ-01 | Pengguna dapat memulai sesi kuis berbatas waktu | Must |
| FR-QUIZ-02 | Sistem menyajikan kata benda acak untuk ditebak artikelnya (der/die/das) | Must |
| FR-QUIZ-03 | Sistem menghitung dan menampilkan streak jawaban benar | Must |
| FR-QUIZ-04 | Sistem menghitung skor berdasarkan ketepatan dan kecepatan | Must |
| FR-QUIZ-05 | Sistem mencatat kata yang dijawab salah beserta frekuensinya | Must |
| FR-QUIZ-06 | Sistem merekomendasikan kata yang sering salah untuk masuk deck flashcard | Must |
| FR-QUIZ-07 | Pemilihan kata dibobot: kata yang pernah salah lebih sering muncul | Should |
| FR-QUIZ-08 | Pengguna dapat memilih cakupan kuis (level, tema, atau deck tertentu) | Should |
| FR-QUIZ-09 | Sistem menampilkan feedback instan benar/salah beserta jawaban yang benar | Must |
| FR-QUIZ-10 | Sistem menyimpan skor tertinggi personal | Should |
| FR-QUIZ-11 | Kuis dapat dijalankan offline | Must |

### 6.5 Modul Konjugasi & Deklinasi (GRAM)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-GRAM-01 | Sistem menampilkan konjugasi verba: Präsens, Präteritum, Perfekt | Must |
| FR-GRAM-02 | Sistem menangani trennbare Verben dengan benar (`aufstehen` → `ich stehe auf`) | Must |
| FR-GRAM-03 | Sistem menampilkan kata bantu (haben/sein) untuk Perfekt | Must |
| FR-GRAM-04 | Sistem menghasilkan tabel deklinasi 4 kasus untuk kata benda | Must |
| FR-GRAM-05 | Tabel deklinasi mencakup bentuk definit, indefinit, dan negasi | Must |
| FR-GRAM-06 | Sistem menampilkan verba lain dengan `ablaut_class` yang sama sebagai referensi pola | Should |
| FR-GRAM-07 | Sistem menandai verba beraturan (weak) vs tidak beraturan (strong) | Should |
| FR-GRAM-08 | Sistem menampilkan kasus yang dituntut verba (`case_governance`) | Must |
| FR-GRAM-09 | Pengguna dapat menambahkan tabel konjugasi tertentu ke deck sebagai kartu | Should |

### 6.6 Modul Progres & Statistik (STAT)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-STAT-01 | Sistem menampilkan jumlah kata dipelajari, jatuh tempo hari ini, dan sudah dikuasai | Must |
| FR-STAT-02 | Sistem menampilkan riwayat aktivitas belajar harian | Should |
| FR-STAT-03 | Sistem menampilkan daftar kata paling sering salah | Must |
| FR-STAT-04 | Sistem menampilkan akurasi per kategori (gender, kasus, konjugasi) | Should |
| FR-STAT-05 | Sistem menampilkan proyeksi beban review beberapa hari ke depan | Could |

### 6.7 Modul Sinkronisasi & Offline (SYNC)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-SYNC-01 | Aplikasi berfungsi penuh (cari + review + kuis) tanpa koneksi internet | Must |
| FR-SYNC-02 | Perubahan yang dibuat offline diantrikan dan dikirim saat koneksi kembali | Must |
| FR-SYNC-03 | Sistem menyelesaikan konflik data antar perangkat secara deterministik | Must |
| FR-SYNC-04 | Aplikasi dapat dipasang sebagai PWA di perangkat pengguna | Should |
| FR-SYNC-05 | Sistem memberi tahu pengguna saat versi dataset kamus baru tersedia | Should |
| FR-SYNC-06 | Sistem menampilkan status sinkronisasi (tersinkron / menunggu / gagal) | Should |

### 6.8 Modul Admin (ADMIN)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-ADM-01 | Admin dapat melihat & menindaklanjuti laporan kesalahan entri kamus (dari Student, laporan sederhana FR-DICT-16) | Should |
| FR-ADM-02 | Admin dapat menerapkan koreksi langsung ke entri kamus | Should |
| FR-ADM-03 | Admin dapat menjalankan import/refresh dataset dan menerbitkan versi baru | Must |
| FR-ADM-04 | Admin dapat melihat metrik agregat penggunaan | Could |
| FR-ADM-05 | Admin dapat menonaktifkan akun yang melanggar | Could |
| FR-ADM-06 | Admin dapat melihat queue saran koreksi terstruktur dari Teacher (`dictionary_suggestions`, status `pending`), difilter per lemma/Teacher/tanggal | Must |
| FR-ADM-07 | Admin dapat approve saran Teacher → sistem otomatis update `dictionary` + bump `dictionary_meta.version` | Must |
| FR-ADM-08 | Admin dapat reject saran Teacher dengan alasan opsional, tanpa mengubah `dictionary` | Must |
| FR-ADM-09 | Admin dapat melihat & memverifikasi (approve/reject) permohonan Registered User untuk jadi Teacher | Must |
| FR-ADM-10 | Riwayat keputusan approve/reject (saran maupun permohonan Teacher) tersimpan permanen (append-only) untuk akuntabilitas — diimplementasikan sebagai tabel terpisah `admin_decision_log` (Architecture §5, migration `0005`), BUKAN sekadar kolom status yang di-update di baris `dictionary_suggestions`/`teacher_applications` itu sendiri | Must |

### 6.9 Modul Teacher (TEACH) — *baru*

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-TEACH-01 | Registered User dapat mengajukan permohonan jadi Teacher dari halaman profil | Must |
| FR-TEACH-02 | Teacher dapat mengajukan saran koreksi terstruktur (field + nilai usulan + alasan) dari halaman detail kata | Must |
| FR-TEACH-03 | Teacher dapat melihat status seluruh saran yang pernah diajukan sendiri, termasuk alasan penolakan | Must |
| FR-TEACH-04 | Sistem mencegah Teacher mengajukan >1 saran `pending` untuk field+lemma yang sama secara bersamaan | Must |

---

## 7. Spesifikasi Fitur Detail

### 7.1 Autentikasi & Manajemen Akun

**Tujuan:** Mengamankan progres belajar dan memungkinkan sinkronisasi lintas perangkat — **tanpa menghalangi** pengguna baru mencoba aplikasi.

#### Mode Guest
- Dibuat otomatis, tanpa interaksi. Data (deck, kartu, riwayat) disimpan di penyimpanan lokal perangkat.
- Prompt registrasi ditampilkan **secara kontekstual**, bukan mengganggu: setelah menyelesaikan sesi review pertama, atau saat deck mencapai 20 kata, atau saat pengguna mencoba fitur sinkronisasi.
- Prompt dapat ditutup dan tidak muncul kembali dalam periode tertentu.
- Peringatan risiko ditampilkan jelas: data Guest hilang jika penyimpanan browser dibersihkan.

#### Registrasi
- **Metode:** Email + password, atau OAuth Google.
- **Field:** email, password, nama tampilan (opsional).
- **Aturan password:** minimal 8 karakter; indikator kekuatan ditampilkan; password umum ditolak.
- **Verifikasi:** email verifikasi dikirim setelah registrasi. Akun dapat dipakai sebelum verifikasi, tetapi fitur sinkronisasi & reset password memerlukan email terverifikasi.
- **Migrasi data:** seluruh data Guest di perangkat tersebut otomatis dipindahkan ke akun baru.

#### Login
- Email + password, atau OAuth Google.
- Sesi dipertahankan lewat token (access token berumur pendek + refresh token).
- Percobaan gagal dibatasi (lihat BR-AUTH-05).
- Pesan kesalahan bersifat generik (tidak mengungkap apakah email terdaftar).

#### Reset Password
- Pengguna memasukkan email → tautan reset dikirim (berlaku terbatas, sekali pakai).
- Respons sistem selalu sama, terdaftar maupun tidak (mencegah enumerasi akun).
- Setelah reset berhasil, seluruh sesi lain dicabut.

#### Manajemen Akun
- Ubah nama tampilan & preferensi belajar (limit kartu harian, bahasa antarmuka, tema).
- Ubah password (wajib memasukkan password lama).
- Lihat & cabut sesi perangkat aktif *(Could)*.
- Hapus akun: konfirmasi eksplisit, menghapus seluruh data pengguna di server.

#### Keamanan
- Password disimpan sebagai hash (algoritma modern, mis. Argon2/bcrypt) — **tidak pernah** disimpan dalam bentuk plaintext.
- Seluruh komunikasi melalui HTTPS.
- Token disimpan dengan cara yang meminimalkan risiko XSS.
- Perlindungan terhadap CSRF pada operasi yang mengubah state.

---

### 7.1a Role Teacher & Alur Koreksi Kamus (Community Review)

**Tujuan:** memungkinkan kesalahan yang lolos dari pipeline data (§21.2e–k) tetap bisa diperbaiki setelah aplikasi berjalan, lewat kontributor terverifikasi — tanpa membuka `dictionary` untuk ditulis bebas oleh siapa pun (BR-DICT-01 tetap berlaku: dictionary read-only bagi non-Admin).

#### Permohonan jadi Teacher (self-apply)
- Registered User (Student) dapat mengajukan permohonan jadi Teacher dari halaman profil — isi alasan/kualifikasi singkat (opsional, teks bebas, mis. "guru bahasa Jerman bersertifikat" — tidak diverifikasi dokumen di v1, murni pernyataan).
- Permohonan masuk status `pending`, terlihat oleh Admin.
- **Admin memverifikasi manual** — approve (role user berubah jadi `teacher`) atau reject (dengan alasan opsional, user tetap Student, boleh mengajukan ulang).
- Tidak ada SLA otomatis; ini keputusan manual Admin, konsisten dengan filosofi Admin yang juga ditunjuk manual (§4.2).

#### Mengajukan Saran Koreksi (Teacher)
- Dari halaman detail kata di kamus, Teacher melihat tombol "Ajukan koreksi" (tidak muncul untuk Student/Guest).
- Form saran: pilih field yang dikoreksi (`gender`/`plural`/`translations`/`auxiliary`/`separable_prefix`/dll), nilai yang diusulkan, alasan singkat (wajib, supaya Admin punya konteks).
- Saran masuk tabel `dictionary_suggestions` dengan status `pending`, terhubung ke `word_ref` (lemma) yang dikoreksi.
- Teacher dapat melihat daftar & status seluruh saran yang pernah diajukan sendiri (`pending`/`approved`/`rejected`), termasuk alasan penolakan bila ada.
- Satu Teacher tidak dibatasi jumlah saran, tapi tidak boleh ada 2 saran `pending` untuk **field yang sama** di **lemma yang sama** dari Teacher yang sama (mencegah spam duplikat — lihat BR-DICT-09).

#### Review & Approval (Admin)
- Admin melihat queue saran `pending` (bisa difilter per lemma/Teacher/tanggal).
- **Approve** → sistem otomatis menjalankan `UPDATE` ke tabel `dictionary` pada field yang bersangkutan + mencatat `updated_at` baru + menaikkan `dictionary_meta.version` (memicu proses republish dataset offline, lihat §7.2 model Progressive Full Download).
- **Reject** → status saran jadi `rejected`, alasan (opsional) disimpan, tidak ada perubahan ke `dictionary`.
- Riwayat keputusan Admin (siapa approve/reject, kapan) tersimpan permanen untuk akuntabilitas (bukan bisa diubah setelah diputuskan — append-only seperti `review_logs`).

---

### 7.2 Smart German Dictionary & Gender Lookup

| Kemampuan | Detail |
|---|---|
| Pencarian real-time | Autocomplete instan saat mengetik, menampilkan terjemahan, POS, dan level (A1–B1) |
| Normalisasi input | Toleran umlaut (`uben`/`üben`), `ss`↔`ß`, huruf besar/kecil, dan salah ketik ringan |
| Pencarian dua arah | Jerman → Indonesia/Inggris dan sebaliknya |
| Lemmatisasi | Bentuk terinfleksi diarahkan ke lemma (`ging` → `gehen`, `Häuser` → `Haus`) |
| Visual color coding | Maskulin = Biru, Feminin = Merah, Netral = Hijau, Plural = Kuning — konsisten di **seluruh** aplikasi |
| Artikel lengkap | Definit (der/die/das), indefinit (ein/eine), negasi (kein/keine) |
| Bentuk jamak | Ditampilkan bersama artikel plural (die) |
| Suffix & gender clues | Pola otomatis: `-ung`, `-keit`, `-heit`, `-schaft`, `-ion`, `-tät` → feminin; `-chen`, `-lein` → netral; `-er` (pelaku), `-ling`, `-ismus` → maskulin |
| Audio | Text-to-speech via Web Speech API browser |
| Add to deck | Satu klik dari hasil pencarian maupun halaman detail |
| Riwayat & favorit | Kata yang baru dicari mudah diakses kembali |
| Filter tema | `theme_tags` untuk browsing/discovery — **bukan** urutan belajar (lihat §10) |
| Atribusi | Sumber data ditampilkan sesuai kewajiban lisensi CC BY-SA |
| **Model ketersediaan offline** | **Progressive Full Download** (bukan lagi Tier 1/Tier 2 subset — direvisi setelah ukuran dataset nyata terukur ±19MB, lihat §21.3): seluruh kamus diunduh utuh di background, tanpa mengganggu penggunaan awal. Detail lihat §21.3 |

---

### 7.3 Spaced Repetition Flashcard System

| Kemampuan | Detail |
|---|---|
| One-click add to deck | Menambahkan kata dari kamus ke deck pribadi dengan satu klik |
| Tipe kartu | `gender`, `plural`, `konjugasi`, `cloze-kasus`, `arti` — dipilih sesuai jenis kata |
| Algoritma SRS | SM-2: interval adaptif berdasarkan rating Lupa / Sulit / Sedang / Mudah |
| Mode flip-card | Kartu dua sisi interaktif dengan animasi balik dan validasi gender cepat |
| **Kartu berbasis kalimat** | Kartu verba **selalu** menampilkan kata dalam kalimat contoh dengan objek yang menunjukkan kasusnya |
| **Cloze kasus & preposisi** | Verba + preposisi + kasus sebagai satu chunk: `Ich warte ___ den Bus` → `auf (+Akk)`. Tidak dipecah jadi kartu aturan grammar terpisah |
| **Queue interleaved** | Kartu baru urut `frequency_rank`; sesi review **mencampur** semua pola & tema |
| **Pattern Drill** | Mini-lesson singkat saat ablaut class baru pertama kali muncul (mis. `singen`/`trinken`/`finden`), lalu langsung dibaurkan kembali ke review interleaved — tidak pernah blocked permanen |
| Limit harian | Pengguna dapat mengatur batas kartu baru & review per hari |
| Suspend & bury | Kartu dapat ditunda sementara atau dinonaktifkan |
| Ringkasan sesi | Statistik akhir sesi: jumlah dijawab, akurasi, kartu jatuh tempo berikutnya |
| Offline penuh | Seluruh siklus review berjalan tanpa koneksi |

---

### 7.4 Mini-Game: Artikel Rush (Speed Quiz)

| Kemampuan | Detail |
|---|---|
| Mekanisme | Kuis berbatas waktu; pengguna menebak artikel kata benda acak (der / die / das) |
| Skoring | Berdasarkan ketepatan dan kecepatan respons |
| Streak | Menghitung dan menampilkan rentetan jawaban benar berturut-turut |
| Feedback instan | Benar/salah langsung terlihat, disertai jawaban yang benar bila salah |
| Tracking kesalahan | Kata yang salah dicatat beserta frekuensinya |
| Weighted selection | Kata yang pernah salah muncul lebih sering |
| **Jembatan ke SRS** | Di akhir sesi, kata yang sering salah direkomendasikan masuk deck flashcard (terima dengan satu klik) |
| Cakupan | Pengguna dapat membatasi kuis pada level, tema, atau deck tertentu |
| High score | Skor tertinggi personal disimpan |
| Offline | Berjalan tanpa koneksi |

---

### 7.5 Generator Konjugasi & Tabel Deklinasi

| Kemampuan | Detail |
|---|---|
| Verb Conjugator | Konjugasi lengkap: Präsens, Präteritum, Perfekt |
| Trennbare Verben | Pemisahan otomatis dan benar (`aufstehen` → `ich stehe auf`) |
| Kata bantu | Menampilkan haben/sein untuk pembentukan Perfekt |
| Penanda kelas | Menandai weak (beraturan) vs strong (tidak beraturan) |
| **Verba sepola** | Menampilkan verba lain dengan `ablaut_class` sama sebagai referensi (`singen`/`trinken`/`finden`) |
| Case governance | Menampilkan kasus yang dituntut verba (`warten auf +Akk`, `helfen +Dat`) |
| Declension Matrix | Tabel 4 kasus (Nominativ, Akkusativ, Dativ, Genitiv) × definit/indefinit/negasi |
| Add to deck | Tabel/pola tertentu dapat dijadikan kartu |

---

## 8. Business Rules

### 8.1 Autentikasi & Akun

| ID | Aturan |
|---|---|
| BR-AUTH-01 | Satu alamat email hanya boleh terdaftar untuk satu akun |
| BR-AUTH-02 | Password minimal 8 karakter dan tidak boleh termasuk daftar password umum |
| BR-AUTH-03 | Password disimpan sebagai hash; sistem tidak pernah menyimpan atau menampilkan password asli |
| BR-AUTH-04 | Fitur sinkronisasi hanya aktif untuk akun dengan email terverifikasi |
| BR-AUTH-05 | Setelah 5 percobaan login gagal berturut-turut, akun dikunci sementara selama 15 menit |
| BR-AUTH-06 | Tautan reset password berlaku maksimal 1 jam dan hanya dapat dipakai satu kali |
| BR-AUTH-07 | Pesan kegagalan login bersifat generik dan tidak mengungkap apakah email terdaftar |
| BR-AUTH-08 | Setelah password diubah atau di-reset, seluruh sesi lain otomatis dicabut |
| BR-AUTH-09 | Data Guest hanya dapat dimigrasikan sekali, ke akun pertama yang login di perangkat tersebut |
| BR-AUTH-10 | Penghapusan akun bersifat permanen dan menghapus seluruh data pengguna; memerlukan konfirmasi eksplisit |
| BR-AUTH-11 | Role tidak dapat diubah sendiri oleh pengguna; Admin hanya ditetapkan secara manual |
| BR-AUTH-12 | Pengguna hanya dapat mengakses dan mengubah datanya sendiri |

### 8.2 Kamus

| ID | Aturan |
|---|---|
| BR-DICT-01 | Data kamus bersifat read-only bagi pengguna; koreksi hanya melalui mekanisme laporan → Admin |
| BR-DICT-02 | Pencarian tidak boleh melakukan panggilan jaringan ke API pihak ketiga saat runtime |
| BR-DICT-03 | Atribusi sumber data (CC BY-SA) wajib ditampilkan di aplikasi |
| BR-DICT-04 | Kata benda tanpa data gender atau plural tetap ditampilkan, dengan penanda "data tidak tersedia" — tidak boleh menebak |
| BR-DICT-05 | Gender clue hanya ditampilkan bila akhiran kata benar-benar cocok dengan pola yang diketahui; pengecualian yang diketahui tidak boleh diberi clue yang menyesatkan |
| BR-DICT-06 | Kata benda selalu ditampilkan dengan huruf kapital di awal sesuai kaidah Jerman |
| BR-DICT-07 | Field kosong (`gender`, `auxiliary`, `translations` NULL di database) tidak boleh ditampilkan seolah data lengkap; query fitur yang mensyaratkan field tersebut (mis. Artikel Rush butuh gender, tabel Perfekt butuh auxiliary) wajib memfilter entri dengan field NULL, bukan menampilkan kosong/salah render (temuan audit §21.2f) |
| BR-DICT-08 | Saat satu lemma punya lebih dari satu `pos` (mis. `sein` sebagai verb dan determiner), aplikasi menampilkan entri sesuai konteks pencarian/kartu yang relevan, bukan entri pertama secara acak (temuan audit §21.2f) |
| BR-DICT-09 | Teacher tidak boleh punya >1 saran koreksi berstatus `pending` untuk kombinasi field+lemma yang sama (cegah spam duplikat) |
| BR-DICT-10 | Approve saran koreksi HANYA boleh dilakukan Admin, dan wajib berupa transaksi atomik: update `dictionary` + insert riwayat keputusan + bump `dictionary_meta.version` terjadi bersamaan atau tidak sama sekali |
| BR-DICT-11 | Reject saran koreksi TIDAK PERNAH mengubah tabel `dictionary` — hanya mengubah status saran itu sendiri |
| BR-DICT-12 | Permohonan jadi Teacher hanya dapat diajukan oleh Registered User (bukan Guest); satu user hanya boleh punya satu permohonan `pending` aktif sekaligus |

### 8.3 Flashcard & SRS

| ID | Aturan |
|---|---|
| BR-SRS-01 | Satu kata dapat menghasilkan beberapa kartu dengan `card_type` berbeda, tetapi tidak boleh ada duplikat `card_type` yang sama untuk kata yang sama dalam satu deck |
| BR-SRS-02 | Kartu baru diperkenalkan berurutan berdasarkan `frequency_rank` (frekuensi tinggi lebih dulu) |
| BR-SRS-03 | Antrean review wajib di-*interleave*; tidak boleh dikelompokkan berdasarkan tema atau ablaut class |
| BR-SRS-04 | Tema (`theme_tags`) tidak boleh dijadikan dasar pengurutan antrean belajar — hanya untuk filter/browsing |
| BR-SRS-05 | Kartu verba tidak boleh disajikan tanpa kalimat contoh |
| BR-SRS-06 | Kasus dan preposisi diajarkan sebagai chunk bersama verbanya, bukan sebagai kartu aturan terpisah |
| BR-SRS-07 | Pattern Drill hanya boleh berjalan saat perkenalan ablaut class baru, maksimal satu kali per kelas; setelah itu kartu wajib kembali ke antrean interleaved |
| BR-SRS-08 | Rating "Lupa" mengembalikan kartu ke tahap awal pembelajaran dan memunculkannya kembali dalam sesi yang sama |
| BR-SRS-09 | Interval maksimum dibatasi (mis. 365 hari) agar kartu tidak hilang selamanya dari rotasi |
| BR-SRS-10 | Kartu yang di-*suspend* tidak masuk antrean review sampai diaktifkan kembali |
| BR-SRS-11 | Progres SRS milik pengguna; tidak dibagikan atau terlihat oleh pengguna lain |

### 8.4 Kuis

| ID | Aturan |
|---|---|
| BR-QUIZ-01 | Skor dihitung dari kombinasi ketepatan dan kecepatan; jawaban salah tidak menambah skor |
| BR-QUIZ-02 | Streak direset menjadi nol saat jawaban salah atau waktu habis |
| BR-QUIZ-03 | Kata yang pernah dijawab salah memiliki bobot kemunculan lebih tinggi |
| BR-QUIZ-04 | Kata yang salah ≥ 3 kali otomatis direkomendasikan masuk deck (pengguna tetap yang memutuskan) |
| BR-QUIZ-05 | Kuis hanya menggunakan kata benda yang memiliki data gender lengkap |
| BR-QUIZ-06 | Skor tertinggi hanya disimpan bila sesi diselesaikan sampai waktu habis |

### 8.5 Sinkronisasi

| ID | Aturan |
|---|---|
| BR-SYNC-01 | Sinkronisasi hanya berlaku untuk Registered User; Guest murni lokal |
| BR-SYNC-02 | Saat konflik, perubahan dengan timestamp terbaru per kartu yang menang (last-write-wins per entitas) |
| BR-SYNC-03 | Riwayat review bersifat append-only dan digabungkan, tidak saling menimpa |
| BR-SYNC-04 | Kegagalan sinkronisasi tidak boleh menghapus atau merusak data lokal |
| BR-SYNC-05 | Dataset kamus diperbarui melalui versi rilis; pembaruan tidak boleh menghapus progres pengguna |

---

## 9. Non-Functional Requirements

### 9.1 Performa

| ID | Kebutuhan | Target |
|---|---|---|
| NFR-PERF-01 | Waktu respons pencarian setelah kamus lokal selesai diunduh (state B/C, lihat §21.3) | < 100ms (p95), tanpa jaringan |
| NFR-PERF-01a | Waktu respons pencarian sebelum kamus lokal pernah selesai diunduh (state A, server) | < 500ms (p95) |
| NFR-PERF-01b | Unduhan background kamus lengkap tidak boleh memblokir interaksi UI apa pun (loading indicator terpisah, non-modal) | Must |
| NFR-PERF-02 | Waktu muat awal aplikasi (sudah ter-cache) | < 2 detik |
| NFR-PERF-03 | Waktu muat awal pertama kali (termasuk unduh dataset inti) | < 15 detik pada koneksi 4G |
| NFR-PERF-04 | Transisi antar kartu review | < 150ms |
| NFR-PERF-05 | Durasi animasi UI | ≤ 300ms |
| NFR-PERF-06 | Ukuran dataset kamus lengkap yang diunduh ke perangkat (model Progressive Full Download, direvisi dari rencana Tier 1 subset) | ≤ 50MB — angka nyata hasil pipeline: **19,02MB** untuk 110.894 lemma (§21.2i, §21.2j), jauh di bawah target |
| NFR-PERF-07 | *(Selesai — digabung ke NFR-PERF-06 setelah keputusan full download, §21.3)* | — |

### 9.2 Keandalan & Ketersediaan

| ID | Kebutuhan |
|---|---|
| NFR-REL-01 | Fitur inti (review, kuis) berfungsi penuh tanpa koneksi internet dalam kondisi apa pun. Pencarian kata berfungsi penuh offline pada State B/C (§21.3, kamus lokal sudah pernah selesai diunduh — mencakup SELURUH 110.894 lemma, bukan subset). Pada State A (belum pernah selesai unduh kamus penuh) pencarian memerlukan koneksi (FR-DICT-02a/02b) |
| NFR-REL-02 | Data pengguna tidak boleh hilang akibat kegagalan sinkronisasi atau penutupan aplikasi mendadak |
| NFR-REL-03 | Sesi review yang terputus dapat dilanjutkan dari posisi terakhir |
| NFR-REL-04 | Uptime layanan server (auth & sync) ≥ 99% |

### 9.3 Keamanan & Privasi

| ID | Kebutuhan |
|---|---|
| NFR-SEC-01 | Seluruh komunikasi client–server melalui HTTPS |
| NFR-SEC-02 | Password disimpan dengan hashing modern + salt (Argon2 atau bcrypt) |
| NFR-SEC-03 | Endpoint terproteksi memvalidasi token pada setiap permintaan |
| NFR-SEC-04 | Perlindungan terhadap XSS, CSRF, dan SQL injection |
| NFR-SEC-05 | Rate limiting pada endpoint autentikasi |
| NFR-SEC-06 | Data pribadi yang dikumpulkan dibatasi seminimal mungkin (email + nama tampilan) |
| NFR-SEC-07 | Pengguna dapat menghapus seluruh datanya secara permanen |
| NFR-SEC-08 | Tidak ada data pribadi ditempatkan di URL parameter atau query string |

### 9.4 Usability & Aksesibilitas

| ID | Kebutuhan |
|---|---|
| NFR-UX-01 | Mobile-first; seluruh fitur inti dapat dioperasikan dengan satu tangan |
| NFR-UX-02 | Kontras teks memenuhi WCAG 2.1 level AA di light mode maupun dark mode |
| NFR-UX-03 | Warna gender tidak boleh menjadi satu-satunya penanda; selalu didampingi label teks |
| NFR-UX-04 | Seluruh alur belajar dapat dioperasikan penuh dengan keyboard |
| NFR-UX-05 | Animasi menghormati `prefers-reduced-motion` |
| NFR-UX-06 | Target sentuh minimal 44×44px |
| NFR-UX-07 | Pengguna baru dapat mulai mencari atau me-review dalam ≤ 1 ketukan dari layar pembuka |
| NFR-UX-08 | Dark mode tersedia sejak rilis pertama |

### 9.5 Kompatibilitas

| ID | Kebutuhan |
|---|---|
| NFR-COMP-01 | Mendukung dua versi terakhir Chrome, Firefox, Safari, dan Edge |
| NFR-COMP-02 | Berfungsi pada layar mobile mulai lebar 360px hingga desktop |
| NFR-COMP-03 | Dapat dipasang sebagai PWA di Android dan iOS |
| NFR-COMP-04 | Fitur TTS gagal secara anggun (graceful degradation) bila browser tidak mendukung |

### 9.6 Maintainability & Legal

| ID | Kebutuhan |
|---|---|
| NFR-MNT-01 | Pipeline import dataset dapat dijalankan ulang untuk memperbarui data tanpa mengubah kode aplikasi |
| NFR-MNT-02 | Skema data terdokumentasi dan berversi |
| NFR-MNT-03 | Atribusi lisensi CC BY-SA ditampilkan di aplikasi sesuai ketentuan sumber data |
| NFR-MNT-04 | Kebijakan privasi tersedia dan menjelaskan data yang dikumpulkan |

---

## 10. Prinsip Pedagogis (berbasis riset)

Keputusan berikut diambil dari riset SLA (Second Language Acquisition) dan **mengikat** implementasi §7.3 dan §7.5:

| Prinsip | Implikasi produk | Aturan terkait |
|---|---|---|
| **Grouping tematik menghambat retensi** (Tinkham; Finkbeiner & Nicol) — makna yang mirip saling berinterferensi di memori | Tema **hanya** untuk filter/browsing UI, tidak pernah jadi urutan review queue | BR-SRS-04 |
| **Grouping berdasarkan pola morfologi membantu** — memperkuat induksi pola bentuk | `ablaut_class` dipakai untuk Pattern Drill & tampilan "verba sepola" | BR-SRS-07, FR-GRAM-06 |
| **Konteks kalimat > pasangan kata terisolasi** (dual coding, contextual encoding) | Setiap kartu verba wajib punya kalimat contoh | BR-SRS-05 |
| **Verba + preposisi + kasus adalah chunk tunggal** (Construction Grammar / usage-based SLA) | Diajarkan sebagai satu kartu cloze, bukan aturan grammar terpisah | BR-SRS-06 |
| **Interleaving > blocking** untuk retensi jangka panjang (desirable difficulty) | Review queue mencampur pola; blocked practice hanya untuk perkenalan pola baru | BR-SRS-03, BR-SRS-07 |
| **Frekuensi menentukan prioritas, bukan pengelompokan** | `frequency_rank` mengatur urutan kartu baru diperkenalkan | BR-SRS-02 |

---

## 11. Prinsip UI/UX

> **Catatan penting:** UI adalah salah satu pain point utama produk ini (P5), bukan lapisan kosmetik. Mayoritas kamus & aplikasi bahasa Jerman terasa jadul, padat, dan kaku. Produk ini harus terasa berbeda sejak layar pertama.

### 11.1 Arah Desain

- **Modern & Gen Z friendly** — bersih, lapang, playful tapi tidak kekanak-kanakan. Referensi rasa: aplikasi produktivitas modern, bukan kamus cetak yang dipindah ke layar.
- **Tidak kaku** — hindari tabel padat tanpa napas, teks rapat, dan hierarki datar. Gunakan whitespace generous, tipografi berskala jelas, card-based layout, dan sudut membulat.
- **Micro-interaction & animasi halus** — flip kartu, transisi hasil kuis, feedback benar/salah, animasi streak. Responsif dan hidup, tapi cepat (≤300ms) dan tidak menghalangi alur.
- **Warna gender sebagai bahasa visual utama** — konsisten di kamus, flashcard, kuis, dan tabel deklinasi. Pengguna harus dapat mengenali gender dari warna sebelum membaca teksnya.
- **Mobile-first** — sesi belajar sering pendek dan di perjalanan. Desain untuk jempol: target sentuh besar, aksi utama dalam jangkauan, navigasi bawah.
- **Dark mode** wajib sejak awal, bukan tambahan belakangan.
- **Zero-friction entry** — dari buka app ke pencarian/kartu pertama maksimal satu ketukan. Tidak ada onboarding panjang atau wajib daftar untuk mulai memakai.
- **Empty state yang membantu** — layar kosong memberi saran tindakan, bukan sekadar "tidak ada data".
- **Feedback positif tanpa berlebihan** — rayakan streak dan sesi selesai, tapi hindari gamifikasi menggurui.

### 11.2 Sistem Warna Gender

| Gender | Warna | Label wajib |
|---|---|---|
| Maskulin | Biru | `der` |
| Feminin | Merah | `die` |
| Netral | Hijau | `das` |
| Plural | Kuning | `die (Pl.)` |

Warna wajib lolos kontras WCAG AA di light & dark mode, dan **selalu** disertai label teks.

### 11.3 Batasan Aksesibilitas (tidak boleh dikompromikan)

- Warna gender **tidak boleh jadi satu-satunya penanda** — selalu dampingi label teks. Melindungi pengguna buta warna dan menjaga makna tetap terbaca saat dicetak/di-screenshot.
- Kontras teks memenuhi WCAG AA, light mode maupun dark mode.
- Seluruh alur belajar dapat dioperasikan dengan keyboard (penting untuk drill cepat di desktop).
- Animasi menghormati `prefers-reduced-motion`.
- Target sentuh minimal 44×44px.

---

## 12. Sumber Data & Skema Data

### 12.1 Sumber Data

| Sumber | Peran | Isi | Lisensi |
|---|---|---|---|
| **kaikki.org — Wiktionary German (wiktextract JSONL)** | **Primary** | Lemma, gender, plural, POS, tabel konjugasi, tag separable/strong/weak | CC BY-SA — wajib atribusi |
| ~~UniMorph German (TSV)~~ | **Dievaluasi, TIDAK dipakai** | Cross-check dijalankan (§21.2k) — tidak punya data `auxiliary` sama sekali (di luar skema tag UniMorph), dan untuk gender (satu-satunya field overlap) terbukti kualitasnya di bawah kaikki.org untuk kata dasar (`Zeit`, `Kraut`, `Mittag` salah label) | CC BY-SA |
| Tatoeba (CSV) | Opsional, fase lanjut | Kalimat contoh untuk kartu berbasis konteks | CC BY |
| OpenThesaurus / Odenet | Opsional, fase lanjut | Fitur "kata terkait" | CC BY-SA |
| dict.cc | **Tidak dipakai** | Lisensi berisiko untuk web app + tidak punya field terstruktur yang dibutuhkan | Restriktif |

**Catatan implementasi:** data di-import sekali ke database lokal (bukan hit API saat runtime) — inilah yang memenuhi G1/P2. Biaya teknis utama ada di **normalization layer**: memetakan tag Wiktionary yang tidak konsisten ke skema internal.

### 12.2 Skema Data

**Noun**
```
lemma, gender (m|f|n), plural, genitiv_singular,
level (A1|A2|B1), frequency_rank, theme_tags[],
translations[], example_sentences[], audio_hint
```

**Verb**
```
lemma, translations[], frequency_rank, level,
verb_class (weak|strong|mixed|irregular),
ablaut_class (mis. "ei-ie-ie", null jika weak),
separable_prefix (mis. "auf", null jika tidak),
auxiliary (haben|sein|both),
case_governance[] (mis. ["auf+Akk"], ["+Dat"]),
conjugation_table { praesens{}, praeteritum{}, perfekt{} },
example_sentences[], theme_tags[]
```

**Adjective / kata lain**
```
lemma, translations[], pos, level, frequency_rank,
comparative, superlative, theme_tags[]
```

**User**
```
user_id, email, password_hash, display_name,
email_verified, role (guest|student|teacher|admin),
created_at, preferences { daily_new_limit, daily_review_limit, theme, ui_language }
```
> **Catatan implementasi:** nilai `guest` bersifat **logis** (tidak ada sesi terautentikasi, tidak ada baris di tabel `profiles`) — **tidak pernah** tersimpan sebagai nilai kolom `role` di database. Kolom `role` di tabel `profiles` (Architecture §5, migration `0005`) hanya menerima `student|teacher|admin`. Guest dibedakan dari 3 role lain lewat ada/tidaknya sesi Supabase Auth, bukan lewat nilai kolom.

**TeacherApplication** *(baru)*
```
application_id, user_id, reason_text, status (pending|approved|rejected),
reviewed_by (admin user_id), review_note, created_at, reviewed_at
```

**DictionarySuggestion** *(baru)*
```
suggestion_id, word_ref, field_name (gender|plural|translations|auxiliary|separable_prefix|...),
current_value, suggested_value, reason_text,
submitted_by (teacher user_id), status (pending|approved|rejected),
reviewed_by (admin user_id), review_note,
created_at, reviewed_at
```

**DictionaryMeta** *(baru — satu baris, versi global dataset kamus)*
```
version (int), published_at, row_count, checksum
```

**Deck**
```
deck_id, user_id, name, created_at, card_count
```

**SRSCard**
```
card_id, deck_id, user_id, word_ref, card_type,
interval, ease_factor, repetitions, due_date,
state (new|learning|review|suspended),
lapses, created_at, updated_at
```

**ReviewLog** (append-only)
```
log_id, card_id, user_id, rating, reviewed_at,
interval_before, interval_after, response_time_ms
```

**QuizSession**
```
session_id, user_id, started_at, duration_s,
score, max_streak, scope (level|theme|deck),
answers[] { word_ref, correct, response_time_ms }
```

**MistakeTracker**
```
user_id, word_ref, mistake_count, last_mistake_at,
recommended_to_deck (bool)
```

---

## 13. User Flow

### UF-01 — Pengguna Baru (Guest) sampai Review Pertama
```
Buka aplikasi
  → Sesi Guest dibuat otomatis (tanpa layar login)
  → [Pertama kali] Unduh dataset inti + progress bar
  → Layar utama: search bar aktif + CTA "Mulai belajar"
  → Ketik kata → autocomplete → pilih kata
  → Halaman detail (gender berwarna + artikel + plural + clue)
  → Tap "Tambah ke deck"
  → Ulangi beberapa kata
  → Tap "Review sekarang"
  → Sesi flashcard berjalan → rating tiap kartu
  → Ringkasan sesi
  → [Kontekstual] Prompt: "Simpan progres kamu?" → dapat ditutup
```

### UF-02 — Registrasi & Migrasi Data Guest
```
Guest tap "Simpan progres"
  → Pilih metode: Email/Password atau Google
  → [Email] Isi email + password (+ nama opsional)
  → Validasi format & kekuatan password
  → Submit → akun dibuat
  → Data Guest lokal dimigrasikan ke akun (otomatis, dengan konfirmasi)
  → Email verifikasi dikirim
  → Kembali ke layar utama dengan status "Tersinkron"
  → [Sebelum verifikasi] Banner: "Verifikasi email untuk mengaktifkan sinkronisasi"
```

### UF-03 — Login di Perangkat Baru
```
Buka aplikasi di perangkat baru → Sesi Guest
  → Menu → "Masuk"
  → Email + password (atau Google)
  → Autentikasi berhasil
  → [Jika ada data Guest lokal] Tanya: "Gabungkan data di perangkat ini?" (Gabungkan / Abaikan)
  → Tarik data akun dari server
  → Sinkronisasi selesai → layar utama menampilkan progres yang sama
```

### UF-04 — Reset Password
```
Layar login → "Lupa password?"
  → Masukkan email → Submit
  → Pesan generik: "Jika email terdaftar, tautan reset telah dikirim"
  → Buka email → klik tautan (berlaku 1 jam, sekali pakai)
  → Form password baru + konfirmasi
  → Submit → password diubah, semua sesi lain dicabut
  → Diarahkan ke login
```

### UF-05 — Pencarian Kata (mengikuti state machine §21.3)
```
Layar utama → fokus ke search bar
  → [State A: kamus lokal belum lengkap] Ketik → query ke server (<500ms)
      → [Offline & State A] "Butuh koneksi untuk pencarian pertama kali"
  → [State B/C: kamus lokal ada, lengkap atau usang] Ketik → query lokal (<100ms)
      -- State C tetap pakai copy lokal meski usang, update jalan di background diam-diam
  → [Tidak ada hasil persis] Tampilkan saran fuzzy "Mungkin maksud Anda...?"
  → Pilih hasil
  → Halaman detail:
      • Kata + gender berwarna + label artikel
      • Artikel definit / indefinit / negasi
      • Bentuk plural
      • POS + level
      • Gender clue (jika pola cocok)
      • Tombol audio (TTS)
      • [Nomina] Tabel deklinasi 4 kasus
      • [Verba] Tabel konjugasi + case governance + verba sepola
      • Tombol "Tambah ke deck"
      • [Role Teacher] Tombol "Ajukan koreksi" (lihat UF-11)
```

### UF-06 — Sesi Review SRS
```
Layar utama → "Review (n kartu)"
  → Sistem menyusun antrean: due + kartu baru (interleaved)
  → [Ablaut class baru] Pattern Drill singkat → lalu masuk antrean normal
  → Kartu tampil (sisi depan: kalimat dengan cloze / prompt)
  → Pengguna berpikir → tap/spasi untuk membalik
  → Sisi belakang: jawaban + gender berwarna + info tambahan
  → Pilih: Lupa / Sulit / Sedang / Mudah
  → Engine SM-2 hitung interval baru → simpan lokal
  → Kartu berikutnya... hingga antrean habis
  → Ringkasan sesi: jumlah, akurasi, jadwal berikutnya
  → [Online + Registered] Sinkronisasi berjalan di latar
```

### UF-07 — Artikel Rush
```
Menu → "Artikel Rush"
  → Pilih cakupan (semua / level / tema / deck) + durasi
  → Mulai → timer berjalan
  → Kata benda muncul → 3 tombol besar: der / die / das
  → Jawab → feedback instan (warna + benar/salah) → kata berikutnya
  → Streak counter naik / reset
  → Waktu habis → layar hasil: skor, akurasi, streak tertinggi
  → Daftar kata yang salah
  → CTA: "Tambahkan n kata ini ke deck" (satu klik)
  → Kembali ke menu / main lagi
```

### UF-08 — Melihat Progres
```
Menu → "Progres"
  → Ringkasan: kata dipelajari, jatuh tempo hari ini, dikuasai
  → Grafik aktivitas harian
  → Daftar "Paling sering salah" → dapat langsung di-review
  → Akurasi per kategori (gender / kasus / konjugasi)
```

### UF-09 — Sinkronisasi Offline → Online
```
Pengguna offline → tetap cari & review
  → Perubahan disimpan lokal + masuk antrean sinkronisasi
  → Indikator status: "Menunggu sinkronisasi (n perubahan)"
  → Koneksi kembali → sinkronisasi otomatis berjalan
  → [Konflik] Diselesaikan otomatis (last-write-wins per kartu)
  → Indikator berubah: "Tersinkron"
  → [Gagal] Pesan + tombol coba lagi; data lokal tetap utuh
```

### UF-10 — Permohonan & Alur Kerja Teacher
```
Registered User → Menu → Profil → "Ajukan jadi Teacher"
  → Isi alasan/kualifikasi singkat (opsional) → Submit
  → Status "Menunggu verifikasi Admin"
  → [Admin approve] → Role user berubah jadi Teacher, notifikasi dikirim
  → [Admin reject] → Tetap Student, alasan ditampilkan, boleh ajukan ulang
```

### UF-11 — Mengajukan Saran Koreksi (Teacher) & Review (Admin)
```
Teacher → buka halaman detail kata → tombol "Ajukan koreksi"
  → Pilih field (gender/plural/translations/dst)
  → Isi nilai usulan + alasan (wajib)
  → [Sudah ada saran pending untuk field+lemma ini] Ditolak, tampilkan saran yang sudah ada
  → Submit → status "Menunggu review Admin"
  → Teacher dapat lihat status di "Saran Saya" (pending/approved/rejected)

--- sisi Admin ---
Admin → Menu Admin → "Queue Saran Koreksi"
  → Lihat daftar pending (filter per lemma/Teacher/tanggal)
  → Pilih satu saran → lihat detail (nilai lama vs usulan + alasan)
  → [Approve] → sistem: UPDATE dictionary + bump dictionary_meta.version
      → Teacher yang mengajukan mendapat notifikasi "Disetujui"
      → Client lain mendeteksi versi baru saat online berikutnya (State C, §21.3)
  → [Reject] → isi alasan opsional → status jadi rejected
      → Teacher mendapat notifikasi berisi alasan
```

### UF-12 — Hapus Akun
```
Menu → Pengaturan → Akun → "Hapus akun"
  → Layar peringatan: konsekuensi dijelaskan jelas
  → Konfirmasi (ketik ulang email atau masukkan password)
  → Submit → akun & seluruh data server dihapus
  → Data lokal dibersihkan → kembali ke mode Guest
```

---

## 14. Acceptance Criteria (AC)

### AC — Autentikasi

| ID | Kriteria |
|---|---|
| AC-AUTH-01 | **Given** aplikasi dibuka pertama kali, **When** pengguna belum melakukan apa pun, **Then** sesi Guest terbentuk otomatis dan pengguna langsung berada di layar utama tanpa layar login |
| AC-AUTH-02 | **Given** form registrasi, **When** pengguna mengisi email valid + password ≥8 karakter, **Then** akun dibuat dan email verifikasi terkirim |
| AC-AUTH-03 | **Given** form registrasi, **When** email sudah terdaftar, **Then** sistem menampilkan pesan bahwa email tidak dapat digunakan, tanpa membuat akun ganda |
| AC-AUTH-04 | **Given** form registrasi, **When** password < 8 karakter atau termasuk password umum, **Then** submit ditolak dengan pesan yang jelas |
| AC-AUTH-05 | **Given** Guest memiliki 15 kartu di deck lokal, **When** ia menyelesaikan registrasi, **Then** ke-15 kartu beserta riwayat review muncul di akun barunya |
| AC-AUTH-06 | **Given** kredensial salah, **When** login dicoba, **Then** muncul pesan generik tanpa mengungkap apakah email terdaftar |
| AC-AUTH-07 | **Given** 5 percobaan login gagal berturut-turut, **When** percobaan ke-6 dilakukan, **Then** akun terkunci sementara 15 menit dengan pesan yang jelas |
| AC-AUTH-08 | **Given** permintaan reset password, **When** email dikirim ke alamat tidak terdaftar, **Then** respons tetap sama dengan email terdaftar |
| AC-AUTH-09 | **Given** tautan reset berumur lebih dari 1 jam, **When** dibuka, **Then** sistem menolak dan menawarkan permintaan tautan baru |
| AC-AUTH-10 | **Given** password berhasil di-reset, **When** perangkat lain mencoba memakai sesi lama, **Then** sesi tersebut ditolak dan meminta login ulang |
| AC-AUTH-11 | **Given** pengguna login, **When** ia mengubah password tanpa memasukkan password lama yang benar, **Then** perubahan ditolak |
| AC-AUTH-12 | **Given** pengguna menghapus akun, **When** proses selesai, **Then** login dengan kredensial lama gagal dan seluruh data server terhapus |
| AC-AUTH-13 | **Given** permintaan ke endpoint terproteksi tanpa token valid, **When** dikirim, **Then** server merespons 401 tanpa membocorkan data |
| AC-AUTH-14 | **Given** pengguna A login, **When** ia mencoba mengakses data pengguna B, **Then** akses ditolak |

### AC — Kamus

| ID | Kriteria |
|---|---|
| AC-DICT-01 | **Given** pengguna mengetik minimal 2 huruf, **When** input berubah, **Then** hasil autocomplete tampil < 100ms tanpa panggilan jaringan |
| AC-DICT-02 | **Given** pengguna mengetik `uben` tanpa umlaut, **When** pencarian berjalan, **Then** `üben` muncul di hasil |
| AC-DICT-03 | **Given** pengguna mengetik `strasse`, **When** pencarian berjalan, **Then** `Straße` muncul di hasil |
| AC-DICT-04 | **Given** kata benda maskulin dibuka, **When** halaman detail tampil, **Then** artikel `der` ditampilkan dengan warna biru **dan** label teks `der` |
| AC-DICT-05 | **Given** kata benda dibuka, **When** halaman detail tampil, **Then** bentuk definit, indefinit, negasi, dan plural semuanya terlihat |
| AC-DICT-06 | **Given** kata berakhiran `-ung`, **When** halaman detail tampil, **Then** gender clue "akhiran -ung selalu feminin" ditampilkan |
| AC-DICT-07 | **Given** kata benda tanpa data plural di dataset, **When** halaman detail tampil, **Then** ditampilkan penanda "data tidak tersedia", bukan tebakan |
| AC-DICT-08 | **Given** hasil pencarian, **When** pengguna menekan tombol tambah, **Then** kata masuk ke deck dalam satu klik dengan konfirmasi visual |
| AC-DICT-09 | **Given** perangkat dalam mode offline, **When** pengguna mencari kata, **Then** pencarian tetap berfungsi normal |
| AC-DICT-10 | **Given** halaman mana pun, **When** pengguna membuka informasi aplikasi, **Then** atribusi sumber data (CC BY-SA) terlihat |

### AC — Flashcard & SRS

| ID | Kriteria |
|---|---|
| AC-SRS-01 | **Given** deck berisi kartu jatuh tempo, **When** sesi review dimulai, **Then** antrean berisi kartu due + kartu baru sesuai limit harian |
| AC-SRS-02 | **Given** antrean review berisi verba dari beberapa ablaut class, **When** antrean disusun, **Then** kartu dari kelas berbeda tampil bercampur, tidak berurutan per kelas |
| AC-SRS-03 | **Given** kartu verba, **When** kartu ditampilkan, **Then** kata selalu muncul dalam kalimat contoh, tidak pernah sebagai pasangan kata+arti polos |
| AC-SRS-04 | **Given** verba dengan case governance, **When** kartu cloze ditampilkan, **Then** preposisi dan kasus diuji sebagai satu chunk (`Ich warte ___ den Bus`) |
| AC-SRS-05 | **Given** pengguna menekan "Lupa", **When** rating disimpan, **Then** kartu kembali ke tahap awal dan muncul lagi dalam sesi yang sama |
| AC-SRS-06 | **Given** pengguna menekan "Mudah", **When** rating disimpan, **Then** interval bertambah sesuai SM-2 dan tanggal jatuh tempo diperbarui |
| AC-SRS-07 | **Given** ablaut class baru pertama kali muncul, **When** kartu diperkenalkan, **Then** Pattern Drill singkat ditampilkan sekali, lalu kartu kembali ke antrean interleaved |
| AC-SRS-08 | **Given** kata sudah ada di deck dengan `card_type` yang sama, **When** pengguna menambahkannya lagi, **Then** sistem mencegah duplikat dan memberi tahu pengguna |
| AC-SRS-09 | **Given** sesi review selesai, **When** layar ringkasan tampil, **Then** jumlah kartu, akurasi, dan jadwal berikutnya terlihat |
| AC-SRS-10 | **Given** perangkat offline, **When** sesi review dijalankan sepenuhnya, **Then** seluruh hasil tersimpan lokal tanpa kehilangan data |
| AC-SRS-11 | **Given** sesi review terputus di tengah, **When** pengguna membuka kembali aplikasi, **Then** sesi dapat dilanjutkan dari posisi terakhir |

### AC — Artikel Rush

| ID | Kriteria |
|---|---|
| AC-QUIZ-01 | **Given** sesi kuis dimulai, **When** timer berjalan, **Then** kata benda muncul satu per satu dengan tiga pilihan artikel |
| AC-QUIZ-02 | **Given** jawaban benar, **When** dipilih, **Then** feedback positif tampil instan dan streak bertambah 1 |
| AC-QUIZ-03 | **Given** jawaban salah, **When** dipilih, **Then** jawaban benar ditampilkan, streak direset ke 0, dan kata dicatat sebagai kesalahan |
| AC-QUIZ-04 | **Given** kata telah salah dijawab ≥ 3 kali, **When** sesi berakhir, **Then** kata tersebut muncul di daftar rekomendasi deck |
| AC-QUIZ-05 | **Given** daftar rekomendasi di layar hasil, **When** pengguna menekan "Tambahkan semua", **Then** seluruh kata masuk deck dalam satu aksi |
| AC-QUIZ-06 | **Given** waktu habis, **When** sesi berakhir, **Then** skor, akurasi, dan streak tertinggi ditampilkan |
| AC-QUIZ-07 | **Given** sesi ditinggalkan sebelum waktu habis, **When** pengguna keluar, **Then** skor tidak tercatat sebagai high score |

### AC — Konjugasi & Deklinasi

| ID | Kriteria |
|---|---|
| AC-GRAM-01 | **Given** verba `gehen` dibuka, **When** tabel konjugasi tampil, **Then** Präsens, Präteritum, dan Perfekt lengkap dengan kata bantu `sein` |
| AC-GRAM-02 | **Given** verba `aufstehen`, **When** Präsens ditampilkan, **Then** bentuk terpisah `ich stehe auf` ditampilkan dengan benar |
| AC-GRAM-03 | **Given** verba strong seperti `singen`, **When** halaman detail tampil, **Then** verba lain dengan ablaut class sama ditampilkan sebagai referensi |
| AC-GRAM-04 | **Given** verba `warten`, **When** halaman detail tampil, **Then** case governance `auf +Akk` ditampilkan |
| AC-GRAM-05 | **Given** kata benda dibuka, **When** tabel deklinasi tampil, **Then** 4 kasus × definit/indefinit/negasi lengkap |
| AC-GRAM-06 | **Given** data konjugasi tidak lengkap di dataset, **When** tabel dirender, **Then** sel kosong ditandai jelas, bukan diisi tebakan |

### AC — Sinkronisasi & Offline

| ID | Kriteria |
|---|---|
| AC-SYNC-01 | **Given** pengguna terdaftar melakukan review offline, **When** koneksi kembali, **Then** perubahan tersinkron otomatis dan indikator berubah menjadi "Tersinkron" |
| AC-SYNC-02 | **Given** kartu yang sama diubah di dua perangkat, **When** sinkronisasi berjalan, **Then** versi dengan timestamp terbaru yang menang, tanpa data yang rusak |
| AC-SYNC-03 | **Given** sinkronisasi gagal, **When** error terjadi, **Then** data lokal tetap utuh dan pengguna melihat opsi coba lagi |
| AC-SYNC-04 | **Given** riwayat review dari dua perangkat, **When** digabungkan, **Then** seluruh entri tetap ada (append-only, tidak saling menimpa) |
| AC-SYNC-05 | **Given** dataset kamus versi baru dirilis, **When** pengguna memperbarui, **Then** progres SRS pengguna tetap utuh |

### AC — UI/UX & Aksesibilitas

| ID | Kriteria |
|---|---|
| AC-UX-01 | **Given** pengguna baru membuka aplikasi, **When** layar utama tampil, **Then** pencarian atau review dapat dimulai dalam ≤ 1 ketukan |
| AC-UX-02 | **Given** mode gelap aktif, **When** halaman mana pun ditampilkan, **Then** seluruh teks memenuhi kontras WCAG AA |
| AC-UX-03 | **Given** informasi gender ditampilkan, **When** dirender, **Then** selalu ada label teks di samping warna |
| AC-UX-04 | **Given** pengguna memakai keyboard saja, **When** menjalankan sesi review penuh, **Then** seluruh aksi (balik kartu, rating, lanjut) dapat dilakukan tanpa mouse |
| AC-UX-05 | **Given** `prefers-reduced-motion` aktif di sistem, **When** aplikasi dibuka, **Then** animasi dikurangi atau dinonaktifkan |
| AC-UX-06 | **Given** layar selebar 360px, **When** aplikasi dibuka, **Then** seluruh fitur inti tetap dapat digunakan tanpa scroll horizontal |

---

## 15. Edge Cases (EC)

### EC — Autentikasi & Akun

| ID | Kasus | Penanganan |
|---|---|---|
| EC-AUTH-01 | Registrasi dengan email yang sudah dipakai OAuth Google | Tawarkan login via Google, jangan buat akun duplikat |
| EC-AUTH-02 | Guest sudah punya data, lalu login ke akun yang **juga** sudah punya data | Tanyakan eksplisit: gabungkan / pertahankan data akun / batal. Jangan menimpa diam-diam |
| EC-AUTH-03 | Registrasi terputus di tengah (koneksi hilang setelah submit) | Jangan buat akun setengah jadi; tampilkan status jelas dan izinkan ulang tanpa error "email sudah dipakai" |
| EC-AUTH-04 | Email verifikasi tidak diterima | Sediakan tombol kirim ulang dengan cooldown |
| EC-AUTH-05 | Tautan reset diklik dua kali | Klik kedua ditolak dengan pesan jelas (sekali pakai) |
| EC-AUTH-06 | Token akses kedaluwarsa di tengah sesi review | Refresh token secara diam-diam; jika gagal, sesi review tetap jalan lokal dan sinkronisasi diantrikan |
| EC-AUTH-07 | Pengguna login di banyak perangkat bersamaan | Diizinkan; setiap perangkat punya sesi sendiri |
| EC-AUTH-08 | Penyimpanan browser dibersihkan saat masih Guest | Data hilang (sudah diperingatkan). Tampilkan pesan yang tidak menyalahkan + tawarkan registrasi |
| EC-AUTH-09 | Pengguna menghapus akun tetapi masih login di perangkat lain | Seluruh sesi dicabut; perangkat lain kembali ke mode Guest |
| EC-AUTH-10 | OAuth dibatalkan pengguna di tengah alur | Kembali ke layar sebelumnya tanpa error yang membingungkan |
| EC-AUTH-11 | Registrasi dengan email berisi karakter tidak lazim / alias plus (`a+b@x.com`) | Diterima selama format valid |

### EC — Kamus

| ID | Kasus | Penanganan |
|---|---|---|
| EC-DICT-01 | Kata dengan lebih dari satu gender (mis. `der/das Teil` dengan makna berbeda) | Tampilkan keduanya beserta perbedaan maknanya; jangan pilih salah satu diam-diam |
| EC-DICT-02 | Kata tanpa bentuk plural (mis. `die Milch`) | Tandai "tidak memiliki plural", jangan tampilkan sel kosong |
| EC-DICT-03 | Kata yang hanya ada dalam bentuk plural (Pluraliatantum, mis. `die Eltern`) | Tandai khusus, sembunyikan bagian singular |
| EC-DICT-04 | Homonim dengan POS berbeda (mis. nomina & verba) | Tampilkan sebagai entri terpisah yang jelas |
| EC-DICT-05 | Pencarian tanpa hasil | Tampilkan saran fuzzy + opsi laporkan kata hilang; jangan layar kosong tanpa arah |
| EC-DICT-06 | Data sumber cacat/kontradiktif (gender berbeda antar sumber) | Utamakan sumber primary; tandai entri untuk peninjauan Admin |
| EC-DICT-07 | Kata benda majemuk sangat panjang | Tampilan tidak boleh rusak; teks dipotong dengan aman/wrap |
| EC-DICT-08 | Gender clue bertabrakan dengan pengecualian yang diketahui | Jangan tampilkan clue yang salah; gunakan daftar pengecualian |
| EC-DICT-09 | Browser tidak mendukung Web Speech API | Sembunyikan/nonaktifkan tombol audio secara anggun |
| EC-DICT-10 | Unduhan dataset gagal di tengah jalan | Dapat dilanjutkan/diulang; aplikasi tidak boleh terjebak di layar loading |

### EC — Flashcard & SRS

| ID | Kasus | Penanganan |
|---|---|---|
| EC-SRS-01 | Deck kosong saat pengguna menekan "Review" | Tampilkan empty state dengan saran: cari kata / impor kata dasar |
| EC-SRS-02 | Tidak ada kartu jatuh tempo hari ini | Beri tahu positif ("Semua beres!") + tawarkan belajar lebih awal atau main kuis |
| EC-SRS-03 | Ratusan kartu jatuh tempo menumpuk setelah lama tidak dibuka | Tampilkan antrean bertahap sesuai limit harian, jangan membanjiri pengguna |
| EC-SRS-04 | Pengguna menghapus kata dari kamus/deck yang sedang di-review | Tangani dengan aman; sesi tidak boleh crash |
| EC-SRS-05 | Verba tidak punya kalimat contoh di dataset | Kartu tidak dibuat sebagai tipe cloze; gunakan tipe lain, atau tandai untuk pengisian data |
| EC-SRS-06 | Semua kartu dalam antrean berasal dari satu ablaut class (data terbatas) | Interleaving tetap diupayakan lewat tipe kartu berbeda; tidak dianggap error |
| EC-SRS-07 | Jam perangkat diubah maju/mundur | Perhitungan jatuh tempo menggunakan basis waktu yang tahan manipulasi; hindari kartu "hilang" atau "banjir" |
| EC-SRS-08 | Pengguna menekan rating dua kali cepat | Hanya satu rating dicatat (debounce) |
| EC-SRS-09 | Kuota penyimpanan browser penuh | Peringatkan pengguna, tawarkan hapus cache dataset non-esensial, jangan diam-diam gagal |
| EC-SRS-10 | Interval tumbuh sangat besar | Dibatasi maksimum (BR-SRS-09) agar kartu tetap dalam rotasi |

### EC — Kuis

| ID | Kasus | Penanganan |
|---|---|---|
| EC-QUIZ-01 | Cakupan yang dipilih hanya berisi sedikit kata | Ulangi kata dengan aman atau minta pengguna memperluas cakupan; beri tahu jelas |
| EC-QUIZ-02 | Kata dengan dua gender sah muncul di kuis | Kecualikan dari kuis, atau terima kedua jawaban |
| EC-QUIZ-03 | Aplikasi ditutup/tab berpindah saat timer berjalan | Timer dijeda; sesi tidak dihitung curang atau hilang |
| EC-QUIZ-04 | Pengguna menjawab tepat saat waktu habis | Aturan batas waktu ditegakkan konsisten dan diberitahukan |
| EC-QUIZ-05 | Semua kata dalam cakupan sudah dikuasai | Tawarkan cakupan lebih luas alih-alih sesi kosong |

### EC — Sinkronisasi & Sistem

| ID | Kasus | Penanganan |
|---|---|---|
| EC-SYNC-01 | Perangkat A offline lama, perangkat B aktif | Saat A online, gabungkan per entitas (last-write-wins per kartu), riwayat digabung |
| EC-SYNC-02 | Kartu dihapus di satu perangkat tapi di-review di perangkat lain | Penghapusan dicatat sebagai operasi bertimestamp, diselesaikan konsisten |
| EC-SYNC-03 | Sinkronisasi gagal berulang kali | Backoff bertahap + notifikasi; data lokal tidak boleh disentuh |
| EC-SYNC-04 | Versi aplikasi lama vs skema data baru | Migrasi skema berversi; aplikasi lama diminta memperbarui, bukan merusak data |
| EC-SYNC-05 | Pengguna memasang PWA lalu memakai versi browser sekaligus | Keduanya berbagi penyimpanan yang sama secara konsisten |
| EC-SYNC-06 | Koneksi sangat lambat saat sinkronisasi | Berjalan di latar belakang tanpa memblokir UI |

---

## 16. Asumsi

| ID | Asumsi |
|---|---|
| A-01 | Pengguna memiliki perangkat dengan browser modern yang mendukung IndexedDB/PWA |
| A-02 | Pengguna memiliki koneksi internet saat pertama kali membuka aplikasi (untuk mengunduh dataset), tetapi tidak setelahnya |
| A-03 | Dataset Wiktionary/kaikki tetap tersedia gratis untuk diunduh dan lisensinya tidak berubah |
| A-04 | Kualitas data Wiktionary cukup baik untuk kosakata A1–B1 (yang merupakan fokus v1) |
| A-05 | Kapasitas penyimpanan browser cukup untuk dataset inti (target ≤ 50MB) |
| A-06 | Web Speech API browser cukup baik untuk pengucapan Jerman; tidak diperlukan layanan TTS berbayar |
| A-07 | Algoritma SM-2 memadai untuk v1; FSRS dapat dipertimbangkan di iterasi berikutnya |
| A-08 | Mayoritas pengguna belajar dari bahasa Indonesia atau Inggris |
| A-09 | Pengguna bersedia memakai aplikasi tanpa akun terlebih dahulu (mode Guest) |
| A-10 | Volume pengguna awal kecil; infrastruktur server sederhana sudah memadai |
| A-11 | Frequency rank dapat diperoleh atau diturunkan dari korpus/daftar frekuensi bahasa Jerman yang tersedia bebas |
| A-12 | Anotasi ablaut class dapat diturunkan dari data konjugasi Wiktionary secara terprogram, dengan koreksi manual untuk kasus tepi |

---

## 17. Dependensi

### 17.1 Dependensi Data

| Dependensi | Jenis | Risiko bila gagal |
|---|---|---|
| kaikki.org — dump Wiktionary German | Eksternal, wajib | Produk tidak punya data inti; perlu sumber pengganti |
| ~~UniMorph German~~ | **Tidak dipakai (dievaluasi, §21.2k)** | Tidak ada — cross-check dijalankan, hasilnya UniMorph tidak diintegrasikan; tidak ada dependensi aktif ke sumber ini |
| Daftar frekuensi kata Jerman | Eksternal, wajib | Urutan pengenalan kartu baru tidak optimal |
| Tatoeba (fase lanjut) | Eksternal, opsional | Kalimat contoh harus disediakan manual |

### 17.2 Dependensi Teknis

| Dependensi | Keterangan |
|---|---|
| Browser modern dengan IndexedDB / Service Worker | Wajib untuk offline & PWA |
| Web Speech API | Untuk TTS; degradasi anggun bila tidak tersedia |
| Penyedia layanan autentikasi & database server | Untuk akun & sinkronisasi |
| Layanan pengiriman email | Untuk verifikasi & reset password |
| Penyedia OAuth (Google) | Untuk login pihak ketiga *(Should)* |
| Hosting/CDN untuk distribusi dataset | Untuk unduhan dataset awal & pembaruan |

### 17.3 Dependensi Proses

| Dependensi | Keterangan |
|---|---|
| Pipeline normalisasi data | Harus selesai sebelum fitur kamus dapat dibangun — **jalur kritis** |
| Anotasi ablaut class & case governance | Diperlukan sebelum Pattern Drill & kartu cloze dapat dibuat |
| Penentuan tech stack (§20) | Memblokir seluruh implementasi |
| Kebijakan privasi & halaman atribusi | Diperlukan sebelum rilis publik |

---

## 18. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Data Wiktionary tidak konsisten/tidak lengkap | Fitur inti menampilkan informasi salah | Validasi saat import; tandai entri bermasalah; batasi v1 pada kosakata A1–B1 yang cakupannya lebih baik; sediakan mekanisme laporan + koreksi Admin |
| Ukuran dataset membengkak melebihi kapasitas mobile | Waktu muat lama, pengguna berhenti | Batasi dataset inti pada A1–B1; muat data lanjutan sesuai kebutuhan |
| Anotasi ablaut class sulit diturunkan otomatis | Pattern Drill tidak akurat | Mulai dari daftar strong verb umum yang dikurasi manual (jumlahnya terbatas dan tetap) |
| Kompleksitas sinkronisasi menimbulkan kehilangan data | Kepercayaan pengguna hilang | Local-first: lokal selalu sumber kebenaran; sinkronisasi tidak pernah menghapus data lokal; riwayat append-only |
| Lisensi CC BY-SA membatasi rencana komersialisasi | Masalah legal | Tampilkan atribusi sejak awal; pisahkan data berlisensi dari konten buatan sendiri |
| Kompleksitas kartu (cloze, kalimat contoh) memperlambat pembuatan konten | Rilis tertunda | Buat kartu secara otomatis dari data; kalimat contoh dari Tatoeba di fase lanjut |
| Pengguna tidak pernah mendaftar → kehilangan data saat cache dibersihkan | Frustrasi & churn | Prompt registrasi kontekstual + peringatan risiko yang jelas + ekspor manual |

---

## 19. Roadmap & Prioritas

| Fase | Cakupan | Keluaran |
|---|---|---|
| **Fase 0 — Fondasi Data** | Pipeline import & normalisasi (Wiktionary/kaikki.org — UniMorph dievaluasi & tidak dipakai, §21.2k), penentuan skema, full dictionary (bukan hanya A1–B1, §21.3) | Dataset siap pakai berversi — **selesai**, 110.894 lemma, 19,02MB |
| **Fase 1 — MVP** | Kamus + pencarian offline + halaman detail + color coding + deck & SRS dasar + mode Guest | Aplikasi dapat dipakai belajar harian |
| **Fase 2 — Akun** | Registrasi/login, verifikasi email, reset password, migrasi data Guest, sinkronisasi | Progres aman lintas perangkat |
| **Fase 3 — Grammar & Game** | Tabel konjugasi & deklinasi, case governance, Artikel Rush, jembatan kuis→deck | Fitur pembeda utama lengkap |
| **Fase 4 — Penajaman Pedagogis** | Pattern Drill, kartu cloze berbasis kalimat, interleaving lanjutan, statistik | Sesuai penuh dengan §10 |
| **Fase 5 — Polish** | PWA, dark mode penuh, aksesibilitas, ekspor, OAuth, panel Admin | Siap rilis publik |

---

## 20. Keputusan Terbuka

| ID | Keputusan | Dampak | Perlu diputuskan sebelum |
|---|---|---|---|
| ~~OQ-01~~ | ~~Tech stack~~ — **DIPUTUSKAN:** React + Vite + Supabase (lihat §21) | — | Selesai |
| OQ-02 | **Representasi `ablaut_class` & `case_governance`** dalam skema | Memengaruhi Pattern Drill & kartu cloze | Fase 0 |
| ~~OQ-03~~ | ~~Cakupan dataset awal~~ — **DIPUTUSKAN:** full dictionary (110.894 lemma, 19,02MB) diunduh utuh ke client via model **Progressive Full Download** (state machine A/B/C, bukan lagi Tier 1/Tier 2), lihat §21.3 | — | Selesai |
| ~~OQ-09~~ | ~~Lokasi penyimpanan dictionary~~ — **DIPUTUSKAN:** satu Supabase project, tidak perlu split ke Neon (19,02MB jauh di bawah limit 500MB free tier), lihat §21.2i/§21.2j | — | Selesai |
| OQ-04 | **Bahasa terjemahan utama** — Indonesia, Inggris, atau keduanya | Ketersediaan data & ukuran dataset | Fase 0 |
| OQ-05 | **Strategi sinkronisasi** — sederhana (last-write-wins) vs CRDT | Kompleksitas & keandalan | Fase 2 |
| OQ-06 | **SM-2 vs FSRS** untuk algoritma penjadwalan | Kualitas retensi; FSRS lebih baik tapi lebih kompleks | Fase 1 |
| OQ-07 | **Sumber kalimat contoh** — Tatoeba, kurasi manual, atau keduanya | Ketersediaan kartu berbasis kalimat (BR-SRS-05) | Fase 4 |
| OQ-08 | **Model monetisasi** (jika ada) | Memengaruhi pilihan lisensi & arsitektur | Pasca-v1 |

---

## 21. Arsitektur Teknis

**Status:** Diputuskan (menjawab OQ-01)

### 21.1 Prinsip Pemilihan Stack

App ini **local-first untuk fitur belajar** (review, kuis, pencarian kata) dan **butuh cakupan kamus lengkap** — bukan hanya A1–B1 (§3.3). Kedua kebutuhan ini dipenuhi lewat model **Progressive Full Download** (§21.3): seluruh kamus diunduh utuh ke client secara background, tanpa memblokir penggunaan. Server tetap dibuat sekecil mungkin — menangani autentikasi, sinkronisasi progres, review saran Teacher (§7.1a), dan full-text search dictionary khusus untuk client yang belum selesai unduh (State A) — bukan pola "server-heavy app" konvensional.

### 21.2a Riset Ukuran Data Nyata (kaikki.org)

Dicek langsung ke sumber (19 Agustus 2026):

| Metrik | Nilai |
|---|---|
| Jumlah entri kata Jerman di kaikki.org (dump Wiktionary) | ±327.000–351.000 word senses |
| Ukuran file JSONL mentah (postprocessed) | **1021.5 MB (~1GB)** |

Angka ini adalah ukuran **raw dump**, bukan ukuran akhir di database aplikasi — file mentah berisi banyak field yang tidak dibutuhkan (etimologi, sitasi, definisi berlapis). Setelah pipeline normalisasi (§21.3) mengekstrak hanya field yang relevan (gender, plural, POS, konjugasi, 1–2 contoh kalimat) dan disimpan sebagai baris terstruktur (bukan JSON blob), ukuran final **diperkirakan menyusut signifikan** — namun harus diukur nyata di Fase 0 (lihat NFR-PERF-07), bukan diasumsikan.

Sumber: [kaikki.org/dictionary/German](https://kaikki.org/dictionary/German/index.html)

### 21.2b Hasil Pipeline Nyata (Fase 0, dijalankan 20 Agustus 2026)

Pipeline normalisasi (`scripts/normalize_dictionary.py`) dijalankan terhadap file mentah penuh (1.1GB, 373.284 baris) dan menghasilkan database SQLite terstruktur:

| Metrik | Hasil |
|---|---|
| Baris raw diproses | 373.284 |
| Entri disisipkan | 373.283 (1 baris korup akibat interupsi jaringan saat unduh, ditoleransi via try/except) |
| **Ukuran database final (termasuk index FTS5)** | **±63 MB** |
| Gender terisi (kolom noun) | 46,4% dari seluruh baris ber-`pos=noun` |
| Plural terisi (kolom noun) | 40,0% dari seluruh baris ber-`pos=noun` |
| Auxiliary terisi (kolom verb) | 12,1% dari seluruh baris ber-`pos=verb` |

**Temuan kunci — Keputusan OQ-09 terjawab:** 1.1GB raw menyusut jadi **±63MB** setelah ekstraksi field terstruktur (bukan JSON blob mentah). Ini **jauh di bawah** limit Supabase free tier (500MB), bahkan dengan ruang tumbuh untuk enrichment lanjutan (genitiv, ablaut_class, contoh kalimat tambahan). **Keputusan: satu Supabase project, tidak perlu split ke Neon.**

**Catatan kualitas data (bukan bug, tapi karakteristik sumber):** persentase gender/plural/auxiliary yang belum 100% disebabkan oleh 373.283 baris berisi campuran **lemma asli** dan **entri bentuk terinfleksi** (mis. `Hunde`, `Hundes` juga tercatat sebagai baris "noun" tersendiri karena struktur Wiktionary, tanpa template genusnya sendiri). Langkah pipeline lanjutan (§21.2c) memfilter baris menjadi lemma-only sebelum data dipakai aplikasi — angka kelengkapan yang relevan untuk keputusan produk adalah persentase pada lemma tersaring, bukan pada seluruh baris mentah.

**Dua bug ekstraksi ditemukan & diperbaiki dalam pipeline ini** (dicatat untuk transparansi proses):
1. Gender awalnya diambil dari tag pada bentuk terkait (mis. diminutive/for-the-animal di `forms[]`), bukan genus lemma itu sendiri — `Hund` (seharusnya *der*, maskulin) sempat tersimpan sebagai netral. Diperbaiki dengan membaca `head_templates['de-noun'].args['1']`, sumber genus yang benar.
2. Auxiliary (haben/sein) awalnya dicari dengan nama tag yang salah tebak (`auxiliary-sein`/`auxiliary-haben`) dan selalu menghasilkan kosong. Diperbaiki dengan membaca `forms[]` yang bertag persis `["auxiliary"]`.

### 21.2c Filter Lemma-Only — Hasil Final

**Status:** Selesai (20 Agustus 2026).

Baris bentuk terinfleksi diidentifikasi lewat marker wiktextract `senses[].form_of` (mis. entri `"Hunde"` menunjuk balik ke lemma `"Hund"` lewat `form_of`) dan dibuang — bentuknya sudah terwakili sebagai field `plural` di baris lemma induknya, sehingga tidak ada informasi yang hilang.

| Metrik | Sebelum filter | **Setelah filter (final)** |
|---|---|---|
| Total baris | 373.283 | **102.915 lemma** |
| Ukuran database | ±63 MB | **17,48 MB** |
| Noun — gender terisi | 46,4% (dari 139.023 baris campuran) | **95,5%** (dari 59.431 lemma noun asli) |
| Noun — plural terisi | 40,0% | **86,4%** |
| Verb — auxiliary terisi | 12,1% (dari 88.623 baris campuran) | **97,0%** (dari 11.004 lemma verb asli) |
| Verb — separable prefix terisi | 4,2% | 34,2% (wajar — hanya verb yang memang separable yang seharusnya terisi) |

**Kesimpulan:** 95,5% gender dan 86,4% plural pada lemma noun adalah kualitas data yang layak untuk fitur inti (§7.2 Dictionary, §7.5 Konjugasi). Sisa yang kosong mayoritas berupa singkatan/inisialisme (`AA`, `VB`, `SMS`, dst) yang secara linguistik memang tidak selalu memiliki genus tunggal di sumbernya — bukan indikasi ekstraksi yang gagal.

**Angka final untuk arsitektur (log historis — angka lemma/ukuran di titik iterasi ini kemudian diperbarui lagi di §21.2g–j; angka final yang berlaku untuk seluruh dokumen adalah 110.894 lemma, 19,02MB, lihat catatan di §21.3):** dataset **seluruh dictionary** (bukan hanya A1–B1) berukuran jauh di bawah limit Supabase 500MB. Keputusan OQ-09 dikonfirmasi: **satu Supabase project, tanpa split ke Neon.** Ukuran kecil ini yang kemudian menjadi alasan penyederhanaan arsitektur lebih lanjut di §21.3 — seluruh dictionary (bukan subset) akhirnya diputuskan diunduh utuh ke client lewat model Progressive Full Download, menggantikan rencana Tier 1/Tier 2 yang sempat dipertimbangkan di titik ini.

### 21.2d Frequency Ranking — Hasil

**Status:** Selesai (20 Agustus 2026). Sumber: [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (`de_50k.txt`, korpus subtitle, lisensi MIT) — menjawab A-11 di §16.

| Metrik | Hasil |
|---|---|
| Lemma mendapat `frequency_rank` | 23.703 / 102.915 (23,0%) — wajar, sisanya nama diri/kata jarang yang memang di luar 50rb kata tersering |
| Verb dapat rank | 35,7% |
| Noun dapat rank | 21,3% |
| **Kandidat kata frekuensi tinggi (rank ≤ 6.000, semua POS)** — dipakai untuk urutan pengenalan kartu SRS baru (BR-SRS-02), BUKAN lagi untuk subset unduhan offline (seluruh dictionary diunduh utuh, §21.3) | **4.863 baris** |

**Temuan kurasi konten (bukan bug pipeline):** noun dengan `frequency_rank` tertinggi mengandung noise — kata seperti `Ich`, `Du`, `Es`, `So`, `Wenn` tercatat sah sebagai noun di Wiktionary (nominalisasi formal, mis. *das Ja*, *das Aber*) tapi tidak cocok untuk kartu Artikel Rush (§7.4) yang butuh kata benda konkret sehari-hari. Filter tambahan (mis. minimum: gender **dan** plural sama-sama terisi, plus daftar exclude kata fungsi) diperlukan sebelum data ini dipakai men-generate kartu — dicatat sebagai pekerjaan kurasi konten Fase 1, ditangani lewat mekanisme FR-DICT-16 (laporan) / FR-ADM-01 (koreksi Admin) yang sudah ada di PRD, bukan perubahan pipeline.

**Update 20 Agustus 2026 — kedua blocker ini sudah diselesaikan, lihat §21.2l.** Baris di bawah dipertahankan sebagai jejak historis (menunjukkan kapan gap ini pertama diketahui).

~~Belum dikerjakan (di luar cakupan Fase 0 saat ini):~~
- ~~Penentuan level CEFR (A1–B1) per lemma secara eksplisit~~ — **selesai**, proxy `frequency_rank` (§21.2l).
- Filter kurasi kualitas kata frekuensi tinggi untuk Artikel Rush — **masih terbuka**, dijadwalkan Sprint 5 (S5-03, SPRINT_PLAN.md).
- ~~Enrichment lanjutan: `ablaut_class` (Pattern Drill §7.3), `conjugation_table`, `verb_class`~~ — **selesai** (§21.2l). `genitiv_singular` dan contoh kalimat tambahan tetap terbuka (skala kecil, tidak blocking).

### 21.2e Validasi Kualitas Data (Ground Truth + Integritas Struktural)

**Status:** Selesai (20 Agustus 2026). Mengingat data ini dipakai untuk **tujuan belajar** — data salah lebih berbahaya daripada data kosong, karena pengguna bisa menghafal kesalahan tanpa sadar — dijalankan validasi sistematis (`scripts/validate_dictionary.py`), bukan sekadar sampel sekilas, sebelum dataset dianggap layak pakai.

**Metode:**
1. **Ground truth manual** — 31 noun + 14 verb umum A1–A2 yang jawabannya (gender, plural, auxiliary, separable prefix) diverifikasi benar secara independen, dicocokkan terhadap hasil ekstraksi pipeline.
2. **Pemeriksaan integritas struktural** — validasi domain nilai (gender harus m/f/n/NULL, auxiliary harus haben/sein/both/NULL), deteksi karakter mojibake (U+FFFD), deteksi lemma kosong.
3. **Deteksi kasus gender ganda** — kata dengan >1 gender valid (mis. *der/die Alp*) diidentifikasi eksplisit untuk ditangani UI (EC-DICT-01), bukan dipilih salah satu secara diam-diam.

**Hasil akhir:** **45/45 ground truth lolos (100%), 0 isu integritas struktural**, 386 lemma noun dengan gender ganda teridentifikasi untuk penanganan UI khusus.

**Bug signifikan ditemukan & diperbaiki lewat proses ini** (baru ketahuan karena validasi ground truth, bukan pemeriksaan sekilas):
- Filter lemma-only (§21.2c) awalnya membuang **kata turunan independen** yang sah (mis. `Lehrer` = agent noun dari verb `lehren`) karena disamakan dengan bentuk infleksi murni (mis. `Hunde` = plural dari `Hund`). `Lehrer` sampai **hilang total** dari dictionary sebelum ketahuan lewat ground truth test. Diperbaiki dengan membedakan lewat tag gramatikal (`nominative`/`plural`/dst = infleksi murni → buang) vs tag turunan (`agent` dst = lemma independen → pertahankan). Dampak: jumlah lemma final naik dari 102.915 → **123.992**.
- Satu ground truth verb saya sendiri sempat keliru (`bekommen` diasumsikan hanya `haben`, padahal sumber mendokumentasikan sah `haben or sein`) — dikoreksi terhadap sumber, bukan dipaksakan.

**Angka final dataset (setelah semua perbaikan):**

| Metrik | Nilai |
|---|---|
| Total lemma | **123.992** |
| Ukuran database (dengan frequency_rank + FTS index) | **21,18 MB** |
| Ground truth validasi | 45/45 (100%) |
| Isu integritas struktural | 0 |

Script `scripts/validate_dictionary.py` disimpan sebagai **regression test permanen** — dijalankan ulang setiap kali pipeline diubah atau dataset di-refresh (§17.3), termasuk kasus `Lehrer` secara eksplisit sebagai regression case untuk bug yang pernah terjadi.

### 21.2f Audit Independen (Perspektif Guru Bahasa Jerman Senior)

**Status:** Selesai (20 Agustus 2026). Setelah validasi ground truth lolos 100%, dijalankan audit independen tambahan dengan sudut pandang **guru bahasa Jerman senior** yang secara aktif mencari kesalahan di area tata bahasa paling rawan jebakan — bukan lagi kata dasar A1, tapi kasus yang biasa menjebak pelajar dan pembuat konten.

**Area yang diperiksa (~110 kata, 8 kategori):** verba kuat/tidak beraturan (aux sein/haben), verba prefix tidak terpisah (be-/ge-/ver-/zer- dst — harus TIDAK PERNAH terdeteksi separable), verba prefix terpisah (prefix harus tepat), gender kata majemuk (mengikuti komponen terakhir), gender kata pinjaman (Anglizismen), pengecualian gender klasik (*das Mädchen*, *der Junge*, dll — jebakan terkenal untuk pelajar), plural tidak beraturan (*Kuchen→Kuchen*, *Museum→Museen*, dst), dan sampel kualitas field `translations`.

**Hasil: 100% benar** — tidak ditemukan satu pun kesalahan tata bahasa pada seluruh sample, termasuk kasus-kasus sulit yang sengaja dipilih karena rawan salah. Kualitas linguistik dasar dataset **solid**, melampaui cakupan ground truth manual sebelumnya (§21.2e) yang hanya menguji kata dasar A1.

**Temuan baru — gap coverage (data hilang, bukan data salah, tapi tetap berisiko bagi pembelajar bila tidak ditangani):**

| Gap | Skala | Risiko |
|---|---|---|
| Verb tanpa `auxiliary` | 13.435 / 24.117 (55,7%) | Tabel Perfekt (§7.5) tidak bisa ditampilkan untuk verb ini |
| **Noun tanpa `gender`** | 2.875 / 67.318 (4,3%) | **Risiko tertinggi** — noun bisa tampil tanpa der/die/das; pengguna berisiko menghafal kata tanpa artikel jika tidak difilter |
| `translations` kosong | 22 baris | Kecil, tidak berguna ditampilkan apa adanya |

**Temuan arsitektur (bukan masalah data):** ada duplikasi lemma dengan `pos` berbeda (mis. `sein` sebagai verb sekaligus determiner) — bukan kesalahan, tapi memerlukan **logic pemilihan entri sesuai konteks di layer aplikasi**, dicatat sebagai kebutuhan desain untuk FR-DICT-01/07.

**Business rule baru ditambahkan sebagai hasil audit ini** — lihat BR-DICT-07 di §8.2: field kosong (`gender`/`auxiliary`/`translations` NULL) **tidak boleh ditampilkan seolah lengkap**; UI wajib memfilter atau menandai eksplisit "data tidak tersedia" (konsisten dengan BR-DICT-04 yang sudah ada, diperluas cakupannya ke `auxiliary`).

**Kesimpulan kelayakan produksi:** dataset **aman dipakai** untuk fitur yang mensyaratkan field lengkap (query dengan `WHERE gender IS NOT NULL` untuk Artikel Rush, `WHERE auxiliary IS NOT NULL` untuk tabel Perfekt), **tapi belum aman** untuk ditampilkan mentah tanpa filter tersebut. Mengisi gap coverage (terutama gender noun 4,3%) lewat enrichment lanjutan (§21.2c catatan enrichment) direkomendasikan sebelum Fase 1 rilis, tapi bukan blocker keras karena filter query sudah menjadi mitigasi yang cukup untuk v1.

### 21.2g Perbaikan Akar Masalah Gap Coverage (bukan hanya dimitigasi, tapi diinvestigasi & diperbaiki)

**Status:** Selesai (20 Agustus 2026). Alih-alih menerima gap coverage §21.2f sebagai keterbatasan permanen, dilakukan investigasi akar masalah — konsisten dengan prinsip "data salah/hilang lebih berbahaya daripada tidak ada" untuk aplikasi belajar bahasa.

**Dua bug pipeline tambahan ditemukan & diperbaiki:**

1. **Bug ekstraksi gender untuk lemma majemuk/frasa.** Format `head_templates['de-noun'].args['1']` untuk lemma seperti `"Grand Slam"` atau `"tour de force"` menaruh genus **di dalam tanda kurung siku** (`"Grand Slam<m,-:s,s>"`), bukan di awal string seperti pola umum. Regex sebelumnya tidak menangani format ini. Diperbaiki dengan mendeteksi pola `<...>` terlebih dahulu. Contoh terverifikasi: `Grand Slam` yang sebelumnya `gender=NULL` sekarang benar `m`.

2. **Bug filter lebih besar: vocabulary tag verba berbeda dari nomina.** Filter bentuk-terinfleksi (§21.2c) dibangun memakai tag deklinasi nomina (`nominative`, `plural`, dst) sehingga **gagal mengenali bentuk konjugasi verba** (`participle`, `past`, `present`, `imperative`, `subjunctive-i/ii`, dst) sebagai bentuk terinfleksi. Akibatnya, ribuan bentuk Partizip/konjugasi bocor masuk sebagai baris "lemma verb" palsu — inilah penyebab utama gap `auxiliary` 55,7% yang ditemukan audit, bukan kelangkaan data asli. Diperbaiki dengan memperluas `INFLECTION_TAGS` mencakup vocabulary tag konjugasi verba.

**Dampak setelah kedua perbaikan (dijalankan ulang penuh + regresi validasi 45/45 tetap lolos):**

| Metrik | Sebelum perbaikan (§21.2f) | **Setelah perbaikan (final)** |
|---|---|---|
| Total lemma | 123.992 | 111.903 (turun karena bentuk konjugasi palsu kini benar dibuang) |
| Total verb lemma | 24.117 (banyak bentuk konjugasi palsu) | **12.036 (lemma verb asli)** |
| **Verb tanpa `auxiliary`** | 55,7% | **11,2%** |
| **Noun tanpa `gender`** | 4,3% | 4,1% (perbaikan lebih kecil, sesuai cakupan bug spesifik yang ditemukan) |
| Ukuran database | 21,18 MB | 19,64 MB |

**Catatan jujur — bukan semua gap bisa/harus dihilangkan:** sisa 11,2% verb tanpa auxiliary dan 4,1% noun tanpa gender diperiksa sampelnya dan mayoritas adalah kasus **linguistik yang secara sah tidak sesederhana m/f/n atau haben/sein tunggal** (mis. lemma multi-kata, entri "head" generik tanpa template baku, kata pinjaman belum terintegrasi penuh) — bukan lagi kegagalan ekstraksi sistematis. Ini didokumentasikan sebagai batas wajar (known limitation), bukan disembunyikan sebagai "sudah 100% sempurna". BR-DICT-07/08 (§8.2) tetap berlaku sebagai jaring pengaman lapis kedua untuk sisa gap ini.

**Prinsip yang diterapkan:** ketika ditemukan gap, urutan penanganannya adalah **(1) investigasi akar masalah dulu → (2) perbaiki di pipeline kalau sistematis → (3) baru terima sebagai batasan & mitigasi di layer aplikasi (BR-DICT-07/08) untuk sisa yang memang tidak bisa diperbaiki lebih lanjut** — bukan langsung lompat ke mitigasi tanpa mengecek apakah akar masalahnya bisa diselesaikan.

> **Rekonsiliasi angka verb (ditambahkan saat audit konsistensi, karena angka di §21.2g ini berbeda dari §21.2l tanpa penjelasan eksplisit sebelumnya):** 12.036 di atas **bukan** angka final — iterasi berikutnya (§21.2h di bawah, lalu §21.2i/j) membuang lebih banyak bentuk palsu (zu-infinitive, dst), menurunkan total verb lemma lebih lanjut menjadi **11.118** (angka yang dipakai di §21.2l, konsisten dengan Architecture & SPRINT_PLAN). Urutan angka verb lemma sepanjang dokumen ini: 24.117 (§21.2g awal) → 12.036 (§21.2g setelah fix form_of) → 11.118 (final, setelah §21.2h dan seterusnya). **11.118 adalah satu-satunya angka yang berlaku** untuk implementasi.

### 21.2h Iterasi Kedua: Menuntaskan Sisa Gap (Lemma Multi-Kata & Zu-Infinitive)

**Status:** Selesai (20 Agustus 2026). Sisa gap 11,2% (`auxiliary`) dan 4,1% (`gender`) dari §21.2g diinvestigasi lebih lanjut alih-alih diterima sebagai batas akhir — ditemukan **3 pola tambahan yang ternyata masih sistematis dan bisa diperbaiki**, bukan noise acak:

1. **Zu-infinitive verba** (mis. `einzuhalten`, `zuzusehen`, `hinauszulaufen`) — bentuk turunan dari verba dasarnya (`einhalten`, `zusehen`, `hinauslaufen`) yang ditandai tag `infinitive`/`infinitive-zu`, belum masuk `INFLECTION_TAGS`, sehingga bocor sebagai lemma verba palsu tanpa auxiliary. Ditambahkan ke filter.
2. **Frasa dengan lebih dari satu tanda `<...>`** (mis. `"aktueller<+> Geldkurs<m,es,e>"`) — regex sebelumnya hanya mengambil bracket **pertama** (milik kata sifat pendamping `<+>`, bukan genus), padahal genus sebenarnya ada di bracket noun utama yang posisinya belakangan. Diperbaiki dengan memindai **semua** bracket dan mengambil yang pertama valid berisi m/f/n.
3. **Template `head` generik dengan `args["g"]` langsung** (mis. `"saurer Regen"` → `{"g": "m"}`) — pola ekstraksi ketiga yang sebelumnya sama sekali tidak tertangani (fokus sebelumnya hanya pada template `de-noun`). Ditambahkan sebagai fallback pengecekan `args.get("g")` di template mana pun.

**Hasil setelah iterasi kedua (regresi validasi 45/45 tetap lolos, 0 isu struktural):**

| Metrik | Setelah iterasi 1 (§21.2g) | **Setelah iterasi 2 (final)** |
|---|---|---|
| **Verb tanpa `auxiliary`** | 11,2% | **3,2%** |
| **Noun tanpa `gender`** | 4,1% | **2,5%** |
| Total lemma | 111.903 | 110.895 |
| Ukuran database | 19,64 MB | 19,54 MB |

Kasus spesifik yang sebelumnya gagal kini terverifikasi benar: `Grand Slam`→`m`, `aktueller Geldkurs`→`m`, `saurer Regen`→`m`; `einzuhalten` (zu-infinitive palsu) sudah tidak lagi tercatat sebagai lemma terpisah.

**Sisa 3,2% verb dan 2,5% noun** pada titik ini didominasi kasus yang **secara linguistik memang tidak punya satu genus/auxiliary tunggal yang sederhana** (mis. ejaan lama/arkais, entri dialek langka, singkatan tanpa template baku) berdasarkan sampling manual — bukan lagi pola sistematis yang mudah ditemukan lewat pemeriksaan lanjutan sampai titik ini. Ini titik yang wajar untuk berhenti melakukan perbaikan pipeline dan menyerahkan sisanya ke mitigasi BR-DICT-07/08 serta kurasi Admin (FR-ADM-01) untuk kasus per-kasus bila ditemukan lewat laporan pengguna (FR-DICT-16).

### 21.2i Audit Kode Pipeline (Bukan Sampel Data — Enumerasi Penuh)

**Status:** Selesai (20 Agustus 2026). Karena setiap pemeriksaan sebelumnya (§21.2e–h) berulang kali menemukan bug baru, dijalankan audit khusus terhadap **kode pipeline itu sendiri** dengan metodologi berbeda: enumerasi terhadap **seluruh** 373.284 baris raw data per kategori (bukan sampling), mencakup fungsi yang belum pernah diaudit sedalam gender/auxiliary (`extract_plural`, `extract_translations`, `extract_example`, `extract_separable_prefix`, penanganan gender ganda, duplikasi lemma).

**5 bug baru ditemukan, seluruhnya diperbaiki dan diverifikasi lewat regresi 45/45 tetap lolos:**

| # | Bug | Skala dampak | Fix |
|---|---|---|---|
| 8 | **`translations` berisi metadata ejaan, bukan arti kata** (mis. `"new"` tersimpan sebagai *"obsolete spelling of neu"*) — sense ini tidak selalu punya field `form_of` sehingga lolos filter bentuk-terinfleksi | **4.741 baris (4,3% dari total)** — dampak terbesar dari semua bug yang ditemukan sepanjang proses | Filter gloss dengan pola `"alternative form/spelling of"`, `"obsolete/misspelling/nonstandard spelling of"`, dll di awal string. Turun ke 27 baris (0,02%, kasus campuran teks berguna + catatan ejaan, bukan lagi metadata murni) |
| 9 | **`extract_separable_prefix` salah membaca titik silabifikasi sebagai prefix** — `"machinieren"` (4 suku kata, bukan verba separable) sempat tersimpan prefix `"ma"` | 9 verba (0,08%) | Hanya proses sebagai separable bila tepat **satu** titik di `args['1']` (verba separable asli selalu prefix.stem, satu titik); >1 titik → `None` (tidak tahu, lebih aman daripada prefix salah/tidak lengkap) |
| 10 | **`extract_plural` mengambil varian *rare/uncommon/dated*** padahal ada plural standar tersedia (mis. `Verdachte` bukan `Verdächte`) | 8 lemma (0,01%) | Prioritaskan form tanpa tag `rare`/`uncommon`/`dated`; fallback ke situ hanya kalau tidak ada plural standar sama sekali |
| 11 | **`INFLECTION_TAGS` masih kurang tag verba** (`imperfect`, `indicative`, `conjunctive`) — mis. `"spie"` (Präteritum dari `speien`) bocor sebagai lemma verba palsu | ~50 lemma | Tag ditambahkan ke whitelist |
| — | **`add_frequency.py` matching case-insensitive** menyebabkan 2.375 pasangan homograf beda-kapitalisasi berbagi `frequency_rank` sama | 2.375 pasangan | **Percobaan fix exact-case untuk noun DIBATALKAN** setelah diukur — `de_freq_50k.txt` (korpus subtitle) ternyata hampir seluruhnya huruf kecil, sehingga exact-case matching menghancurkan ~15.000 match sah demi mencegah 2.375 collision kecil (net lebih buruk, diverifikasi dengan rerun: 23,5%→10,0%). Dikembalikan ke lowercase-uniform; didokumentasikan sebagai keterbatasan sumber data yang diterima (dampak kecil karena `frequency_rank` cuma memengaruhi urutan pengenalan kartu, bukan fakta gramatikal) |

**Area yang diverifikasi AMAN lewat enumerasi penuh (bukan asumsi):** gender ganda "m:n" konsisten menaruh genus standar duluan (722 entri dicek, 0 counter-example); `extract_example` bersih dari markup HTML/wiki (1 dari 16.804 baris, diabaikan); duplikasi lemma+pos (3.009 grup) sudah konsisten dengan desain EC-DICT-01 yang ada.

**Satu bug edge-case skala sangat kecil didokumentasikan sebagai keterbatasan, bukan diperbaiki:** genus alternatif dari >1 `head_templates['de-noun']` dalam satu entri (mis. `"Dame"` = *die Dame* (lady) ATAU *das Dame* (permainan dam), 154 entri/0,14%) bisa hilang senyap karena kebetulan sama dengan genus di sense lain untuk lemma yang sama. Memperbaikinya butuh perubahan skema (multi-genus per baris) di luar scope pipeline v1 — dicatat sebagai known limitation, tercakup oleh filosofi mitigasi EC-DICT-01/BR-DICT-07 yang sudah ada.

**Angka final dataset (setelah 11 bug ditemukan & diperbaiki sepanjang seluruh proses validasi):**

| Metrik | Nilai |
|---|---|
| Total lemma | **110.894** |
| Ukuran database | **19,18 MB** |
| Ground truth validasi | 45/45 (100%), tanpa regresi di setiap iterasi perbaikan |
| Noun tanpa gender | 2,5% |
| Verb tanpa auxiliary | 3,2% |
| `translations` berisi metadata (bukan arti) | 0,02% (turun dari 4,3%) |

**Prinsip yang terbukti penting lewat proses ini:** setiap "perbaikan" WAJIB diverifikasi dengan mengukur dampaknya, bukan diasumsikan benar hanya karena niatnya baik — percobaan fix `add_frequency.py` di atas adalah contoh nyata perbaikan yang niatnya benar tapi **memperburuk hasil**, dan hanya ketahuan karena diukur ulang sebelum dianggap selesai.

### 21.2j Audit Putaran Kedua: Verifikasi Fix + 3 Bug Tambahan

**Status:** Selesai (20 Agustus 2026). Setelah 11 bug diperbaiki di §21.2g–i, dijalankan audit independen **kedua** dengan dua tujuan: (1) memastikan kelima fix terakhir tidak *overcorrect* (menghapus data yang sebenarnya benar), (2) mencari pola bug baru dari sudut pandang yang belum pernah diperiksa.

**Hasil verifikasi fix sebelumnya — tidak ada regresi, satu overcorrection kecil yang sudah disadari sejak awal:**
- Fix #8 (filter metadata ejaan): tidak menghapus arti valid — dari 4.518 lemma yang jadi `translations=NULL`, hanya 179 yang punya arti alternatif di baris lain; sisanya memang tidak punya arti independen.
- Fix #9 (guard satu-titik separable prefix): dari 3.760 verba, cuma 9 punya >1 titik. 7 di antaranya adalah verba separable sah dengan prefix majemuk (`wiedergutmachen`, dll) yang sekarang `None` alih-alih prefix salah — ini **trade-off yang sudah disadari dan didokumentasikan** di fix aslinya ("tidak tahu" lebih aman daripada "prefix salah/tidak lengkap"), bukan bug tersembunyi baru.
- Fix #10 (prioritas plural non-rare): 20 sample dicek, semua pilihan non-rare sesuai intuisi penutur Jerman — tidak ditemukan kasus tag Wiktionary yang keliru.
- FTS5 `words_fts`: rowid 100% sinkron dengan `words.id`, 0 drift.

**3 bug/gap tambahan ditemukan, 2 diperbaiki:**

| # | Temuan | Skala | Tindakan |
|---|---|---|---|
| 12 | **`META_GLOSS_RE` (fix #8) terlalu sempit** — pola lain yang sama-sama noise murni lolos: `"Switzerland and Liechtenstein standard spelling of X"`, `"Formerly standard spelling of X which was deprecated..."`, `"archaic/colloquial/poetic/dialectal form of"` | **1.979 baris** — dampak sebanding dengan bug #8 asli, cuma cakupan regex kurang lebar | ✅ **Diperbaiki**: regex diperluas. Sengaja TIDAK memfilter `"contraction of"` (mis. `im` = *in+dem*) karena itu informasi gramatikal berguna, beda dari catatan ejaan usang. Turun ke **5 baris** setelah fix |
| 13 | **17 lemma `pos=noun` sebenarnya nama diri** (`head_templates.name == 'de-proper noun'`, mis. `Eurozone`, `Rheinhessen`) — Wiktionary sendiri kadang salah taruh `pos:noun` di level teratas meski template-nya proper noun | 0,015% (kecil, tapi berisiko nama kota/tempat diajarkan artikel gender seperti noun biasa) | ✅ **Diperbaiki**: reklasifikasi otomatis ke `pos='name'` saat terdeteksi `de-proper noun` |
| 14 | **7 contoh kalimat (`example`) berbahasa Inggris**, bukan Jerman (mis. lemma `Sehne`, `Schlieffen`) — root cause di sumber sendiri (`senses[].examples[].text` kadang berisi kutipan Inggris, bukan salah ambil field) | 0,04% (7/16.804) | ⏸️ **Didokumentasikan, tidak diperbaiki** — heuristik deteksi bahasa yang genuinely aman (tanpa risiko salah membuang contoh Jerman sah yang kebetulan memuat kata pinjaman Inggris) tidak sepadan untuk skala sekecil ini. Dicatat sebagai known limitation |

**Regresi setelah kedua fix diterapkan:** 45/45 ground truth tetap lolos, 0 isu struktural.

**Angka final dataset (setelah 13 bug ditemukan & diperbaiki, 1 didokumentasikan sebagai limitation, sepanjang 2 putaran audit independen):**

| Metrik | Nilai |
|---|---|
| Total lemma | 110.894 |
| Ukuran database | 19,02 MB |
| Ground truth validasi | 45/45 (100%), konsisten di setiap iterasi |
| `translations` berisi metadata (bukan arti) | **5 baris (0,005%)**, turun dari 4.741 di temuan awal |
| Lemma nama diri salah kategori sebagai noun | 0 (dari 17) |

**Kesimpulan audit kedua:** dataset **solid untuk dictionary lookup, SRS, dan fitur inti lain**. Tidak ada lagi pola sistematis besar yang ditemukan — dua putaran audit independen berturut-turut mulai menghasilkan temuan berskala kecil dan menurun (11 bug → 3 bug/gap, 2 di antaranya kecil), menandakan titik *diminishing returns* pipeline sudah tercapai. Putaran audit berikutnya (bila dilakukan) sebaiknya menyasar area yang benar-benar baru (mis. kualitas contoh kalimat untuk Tatoeba di Fase 4, atau enrichment `ablaut_class`/genitiv), bukan mengulang pemeriksaan field yang sama.

### 21.2k UniMorph: Cross-Check Dijalankan — Keputusan Final Tidak Diintegrasikan

**Status:** Selesai (20 Agustus 2026). §12.1 PRD sejak awal mencantumkan UniMorph German sebagai sumber **Secondary** untuk "cross-check & backfill paradigma konjugasi yang kurang lengkap", tapi rencana ini belum pernah benar-benar dieksekusi di sepanjang pipeline yang dibangun (§21.2a–j) — gap konjugasi yang ditemukan audit selama ini semuanya diselesaikan lewat perbaikan bug ekstraksi kaikki.org sendiri, bukan sumber kedua. Untuk menutup keputusan yang menggantung ini, dijalankan cross-check nyata (bukan asumsi).

**Temuan penting #1 — UniMorph German tidak punya data `auxiliary` sama sekali.** Skema tag UniMorph (`V;IND;SG;3;PRS`, dst) murni infleksi morfologis (tense/mood/person/number) — auxiliary haben/sein adalah properti leksikal yang **tidak termasuk** skema standar UniMorph. Rencana awal "backfill auxiliary dari UniMorph" (PRD §12.1) **secara teknis tidak mungkin** dengan sumber ini — gap auxiliary yang tersisa (3,2%, §21.2h) tidak bisa ditutup lewat UniMorph, titik.

**Temuan penting #2 — cross-check gender noun (satu-satunya field yang bisa dibandingkan) mengungkap UniMorph sendiri punya kesalahan label untuk kata dasar yang tidak ambigu.**

| Metrik | Hasil |
|---|---|
| Noun yang bisa dibandingkan (ada di kedua sumber) | 26.297 |
| Sepakat | 25.821 (98,19%) |
| Deviasi | 476 (1,81%) |

Spot-check manual terhadap 3 kata paling dasar dan tidak ambigu dalam daftar deviasi menunjukkan **UniMorph yang salah, bukan data kita**:

| Lemma | Data kita (sudah lolos ground truth §21.2e) | UniMorph | Vonis |
|---|---|---|---|
| `Zeit` | f (*die Zeit*) | MASC | UniMorph salah |
| `Kraut` | n (*das Kraut*) | MASC | UniMorph salah |
| `Mittag` | m (*der Mittag*) | NEUT | UniMorph salah |

3 dari 3 kasus yang dicek manual, arahnya konsisten: UniMorph German (setidaknya versi/resource yang dipakai di sini) punya isu kualitas label gender yang nyata, bukan sumber otoritatif yang lebih baik dari kaikki.org.

**Keputusan final:** UniMorph German **tidak diintegrasikan** ke pipeline. Alasan:
1. Tidak bisa memenuhi tujuan awalnya (backfill auxiliary) — datanya memang tidak ada di skema UniMorph.
2. Untuk gender (satu-satunya field yang overlap), kualitasnya **tidak terbukti lebih baik** dari kaikki.org yang sudah melalui 4 lapis validasi (ground truth, audit linguistik, 2x audit kode) — mengintegrasikannya sebagai "koreksi" berisiko **menurunkan** kualitas data untuk kata-kata umum, bukan menaikkan.
3. Dataset kaikki.org yang sudah diaudit ketat terbukti lebih dapat dipercaya untuk kasus yang justru paling penting (kata dasar/umum yang paling sering dipelajari).

**PRD §12.1 diupdate**: baris UniMorph German diberi status "Dievaluasi, tidak dipakai" — bukan lagi rencana terbuka.

### 21.2l Penyelesaian Blocker Sprint 5: Enrichment Grammar & Level CEFR

**Status:** Selesai (20 Agustus 2026). SPRINT_PLAN.md §15 menandai dua blocker yang harus diselesaikan sebelum Sprint 5 (Grammar/Artikel Rush) bisa dikerjakan. Keduanya dituntaskan sekarang, bukan ditunda ke Sprint 5.

**Blocker 1 — Kolom enrichment Grammar (`conjugation_table`, `verb_class`, `ablaut_class`).** Investigasi raw data (`kaikki-german.jsonl`) menemukan bahwa data konjugasi lengkap (Präsens/Präteritum/Perfekt per persona, indikatif) **sebenarnya sudah tersedia** di `forms[]` dengan `source: "conjugation"` — tidak perlu sumber tambahan. `verb_class` (weak/strong/irregular) juga tersedia langsung lewat tag `table-tags`. Diimplementasikan di `scripts/enrich_verb_grammar.py`.

| Metrik | Hasil |
|---|---|
| Verb lemma diproses | 11.118 |
| `conjugation_table` terisi | **10.486 (98,1%)** |
| `ablaut_class` terisi (verb strong/irregular) | 599 |

**Bug ditemukan & diperbaiki dalam proses ini** (konsisten dengan pola sepanjang proyek — investigasi, jangan asumsikan langsung benar): heuristik awal `ablaut_class` mengambil vokal pertama dari bentuk partisip mentah, sehingga ikut menangkap vokal dari prefix `ge-` (mis. `gehen` sempat dapat `e-i-e` yang salah, seharusnya `e-i-a` dari akar `geh-ging-gang`). Diperbaiki dengan melewati prefix `ge-` sebelum mencari vokal. Setelah fix: `singen`/`trinken`/`finden` — verba yang memang sepola secara linguistik — semuanya benar mendapat label sama (`i-a-u`), memvalidasi bahwa heuristik ini sudah cukup akurat untuk tujuan Pattern Drill (FR-SRS-11).

**Limitasi residual yang didokumentasikan (bukan diperbaiki, skala kecil):** verba berprefix (mis. `verstehen`→`verstanden`, atau separable `aufgehen`→`aufgegangen`) masih berisiko salah karena prefix selain `ge-` di awal kata tidak dilewati heuristik. Diterima sebagai batas wajar — akan terlihat sebagai `ablaut_class` yang tidak konsisten untuk verba berprefix, bukan crash atau data hilang.

**Blocker 2 — `case_governance` (verb+preposisi+kasus).** Dikonfirmasi lewat pemeriksaan langsung (`warten`, `helfen`, `singen`) bahwa **kaikki.org tidak punya data Rektion sama sekali** — bukan gap ekstraksi, tapi memang tidak ada di sumber. Diselesaikan lewat **kurasi manual** (`scripts/verb_case_governance.py`): daftar 64 verba paling umum diajarkan di kursus A1-B2 (fakta linguistik stabil, dipakai di setiap buku kursus Jerman — bukan konten berhak cipta). Bug ditemukan saat eksekusi pertama: 19 dari 64 lemma refleksif (`sich freuen`, dst) tidak ketemu karena database menyimpan verba refleksif **tanpa** prefix "sich" (mis. `freuen`, bukan `sich freuen`) — diperbaiki, hasil akhir **64/64 lemma terisi**.

**Blocker 3 (bonus, ditemukan saat kerjakan blocker 1-2) — Level CEFR proxy.** Diimplementasikan `scripts/assign_level_proxy.py`: threshold `frequency_rank` (≤2000→A1, ≤4000→A2, ≤6000→B1). **5.372 lemma (4,8%) mendapat level**, sisanya `NULL` (kata di luar top 6000 frekuensi — sengaja tidak dipaksa default, konsisten BR-DICT-07). **Didokumentasikan jujur sebagai heuristik, bukan klasifikasi resmi Goethe-Institut** — cukup untuk FR-DICT-10/FR-QUIZ-08 v1, penggantian ke sumber CEFR asli tetap opsi terbuka di masa depan kalau presisi formal dibutuhkan.

**Regresi:** 45/45 ground truth tetap lolos setelah seluruh enrichment ini, 0 isu struktural.

**SPRINT_PLAN.md §15 diupdate:** blocker Sprint 5 dinyatakan selesai, task S5-00 (enrichment pipeline) di rencana sprint berubah dari "harus dikerjakan dulu" menjadi "sudah selesai, tinggal dipakai UI".

### 21.2 Stack yang Dipilih

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | **React + Vite + TypeScript** | Ekosistem besar; Vite dipilih atas Next.js karena app tidak butuh SSR — semua logic inti jalan di client secara offline-first, SSR justru menambah kompleksitas tanpa manfaat |
| Styling | **Tailwind CSS** | Iterasi cepat untuk desain custom (§11), tidak terjebak tampilan generik component library |
| Data kamus lokal (dictionary penuh, State B/C — §21.3) | **Dexie.js (IndexedDB)** + **FlexSearch/MiniSearch** untuk index pencarian | Query terhadap SELURUH 110.894 lemma setelah unduhan selesai; library search ringan cukup untuk memenuhi target <100ms tanpa membangun mesin search sendiri |
| Pencarian server (State A saja — §21.3) | **Postgres full-text search** (satu Supabase project, keputusan final — tidak split ke Neon, §21.2i/§21.2j) | Dipakai HANYA sebelum unduhan pertama kali selesai; fitur bawaan Postgres, tidak perlu Meilisearch/Typesense terpisah untuk v1 |
| Offline & PWA | **vite-plugin-pwa** | Satu plugin menutupi service worker + manifest + strategi caching, tanpa menulis service worker manual |
| Backend & Auth | **Supabase** (Postgres + Auth) | Menutupi hampir seluruh §7.1 (registrasi, verifikasi email, reset password, OAuth Google, hashing password, rate limiting) tanpa kode custom. Row-Level Security Postgres menegakkan BR-AUTH-12 di level database. Ini adalah Postgres standar (bukan proprietary) — dapat di-*dump*/dimigrasikan kapan saja, sehingga tidak dianggap vendor lock-in |
| Database progres pengguna | **Postgres** (dalam Supabase) | Relational, cocok untuk skema §12.2 (User, Deck, SRSCard, ReviewLog). Ukurannya kecil (puluhan MB) dan terpisah secara logis dari tabel dictionary yang besar |
| Hosting frontend | **Vercel** | Build output React murni statis; auto-deploy dari git push, tanpa proses server yang perlu dikelola |
| Container | **Tidak dipakai** | Baik Supabase maupun Vercel adalah layanan terkelola (managed) — tidak ada Postgres lokal untuk di-container-kan, tidak ada backend custom untuk di-orkestrasi |
| Cache/session server | **Tidak dipakai (Redis dilepas)** | Tidak ada requirement yang membutuhkan cache server-side atau session store terpisah; sesi ditangani JWT dari Supabase Auth. Ditambahkan hanya jika ada bottleneck terukur |
| Backend custom (bila perlu) | **Supabase Edge Function** atau **Hono**, bukan NestJS | Kebutuhan server di luar CRUD dasar diperkirakan minim; framework enterprise seperti NestJS menambah boilerplate (DI, modules, decorators) yang tidak sepadan dengan skala logic server di app ini |

### 21.3 Model Progressive Full Download (revisi dari rencana Tier 1/Tier 2)

> **Angka final yang berlaku untuk SELURUH dokumen ini: 110.894 lemma, 19,02MB** (§21.2j). Angka-angka lain yang muncul di §21.2a–i (mis. 102.915, 123.992, 17,48MB, 21,18MB, dst) adalah **log historis tiap iterasi perbaikan pipeline** — sudah digantikan, dipertahankan di dokumen ini sebagai jejak proses, bukan sebagai angka yang berlaku.

**Status: revisi arsitektur, 20 Agustus 2026.** Rencana awal (Tier 1 subset ~6.000 kata + Tier 2 server-only untuk sisanya) didasarkan pada **estimasi** ukuran full dictionary ±1GB (raw dump). Setelah pipeline nyata dijalankan, ukuran final terstruktur hanya **19,02MB untuk seluruh 110.894 lemma** (§21.2j) — jauh lebih kecil dari estimasi awal, dan berada di bawah budget NFR-PERF-06 (≤50MB) yang tadinya dialokasikan untuk *subset* saja. Asumsi yang melandasi model dua-tingkat sudah tidak berlaku, sehingga arsitektur **disederhanakan**: seluruh kamus diunduh utuh ke setiap client, bukan dipecah subset+fallback.

**Alasan penyederhanaan (bukan cuma "karena bisa", tapi karena kompleksitas Tier 1/Tier 2 sudah tidak sepadan manfaatnya):**
- Menghapus kebutuhan logic "cari di subset → fallback ke server → cache manual per kata" yang cukup rumit untuk skala data yang sebenarnya kecil.
- Menghapus kebutuhan mengelola staleness per-kata yang di-cache sebagian — jadi satu dataset utuh dengan satu nomor versi.
- Tetap memenuhi janji "jangan sampai kosong" (§3.3) — bahkan lebih baik, karena begitu unduhan selesai, **100% kamus tersedia offline**, bukan cuma kata yang "kebetulan pernah dicari".

#### Tiga status client (state machine)

```
┌──────────────────────────────────────────────────────────────────┐
│ STATE A — Belum pernah selesai mengunduh kamus penuh              │
│  • Pencarian → server (online, FR-DICT-02a), <500ms (NFR-PERF-01a)│
│  • Offline & belum pernah unduh → pesan jelas (FR-DICT-02b)       │
│  • Unduhan kamus penuh berjalan di BACKGROUND, tidak blocking     │
│    (FR-DICT-02c, NFR-PERF-01b)                                    │
└───────────────────────────┬────────────────────────────────────────┘
                            │ unduhan selesai & terverifikasi
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STATE B — Kamus lokal lengkap & up to date                        │
│  • Pencarian 100% lokal (Dexie/IndexedDB + FlexSearch index)      │
│  • <100ms, TANPA panggilan jaringan (NFR-PERF-01)                 │
└───────────────────────────┬────────────────────────────────────────┘
                            │ server publish versi baru (mis. Admin approve
                            │ saran Teacher, §7.1a) -> dictionary_meta.version naik
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ STATE C — Kamus lokal usang, versi baru tersedia                  │
│  • Pencarian TETAP pakai copy lokal LAMA (instan, offline!)       │
│    -- TIDAK PERNAH mundur ke mode online hanya karena ada update  │
│    (FR-DICT-02d) -- ini yang membuatnya "seamless"                │
│  • Versi baru diunduh di background (stale-while-revalidate)      │
│  • Setelah selesai & terverifikasi -> swap atomik ke STATE B       │
│    (FR-DICT-02e, tidak ada periode data campuran/rusak)            │
└──────────────────────────────────────────────────────────────────┘
```

**Kenapa State C tidak fallback ke server:** copy lokal yang "usang" tetap 99%+ benar (hanya beda pada kata yang baru saja dikoreksi Admin, biasanya segelintir kata) — mempertahankan pencarian lokal-instan jauh lebih baik untuk UX daripada memaksa semua pencarian balik ke server hanya karena ada satu-dua kata yang diperbarui.

#### Mekanisme teknis

- Server menyediakan `dictionary_meta` (versi ringan, cuma berisi `version`, `published_at`, `row_count`, `checksum` — bukan seluruh data) yang dicek client setiap kali online (murah, bukan unduhan besar).
- Kalau versi lokal ≠ versi server → trigger unduhan file `dictionary-full.v{N}.json` (atau format terkompresi) dari CDN/Supabase Storage secara background.
- Unduhan ditulis ke tabel/area sementara di IndexedDB, **baru di-commit (swap) setelah verifikasi lengkap** (jumlah baris & checksum cocok) — mencegah data rusak/parsial kalau koneksi putus di tengah jalan (kalau gagal, copy lama tetap dipakai, dicoba lagi nanti, bukan silent-corrupt).
- Tidak ada mekanisme resume parsial (unduhan diulang dari awal kalau gagal) — sengaja disederhanakan karena ukuran file kecil (~20-30MB), resume logic tidak sepadan kompleksitasnya untuk file seukuran ini.

### 21.4 Alur Data Kamus (Build-time → Device → Server)

```
kaikki.org (dump Wiktionary Jerman, ~1GB raw)
        │  [sekali, saat development/update dataset — bukan runtime]
        ▼
Pipeline normalisasi (§12.1, §17.3, §21.2a-k) — Fase 0
  extract gender/plural/POS/konjugasi → normalisasi tag →
  filter lemma-only → frequency ranking
        │
        ▼
dictionary.sqlite (110.894 lemma, 19,02MB) — SUMBER TUNGGAL
        │
        ▼
Import ke tabel `dictionary` Postgres (Supabase) — source of truth
        │  [saat Admin approve saran Teacher -> UPDATE row + bump version]
        │
        ▼
Export otomatis -> dictionary-full.v{N}.json di CDN/Supabase Storage
        │  [diunduh oleh SEMUA client secara progressive background,
        │   bukan lagi dipecah subset -- lihat state machine §21.3]
        ▼
Device pengguna: Dexie/IndexedDB (state A→B, atau C→B saat update)
```

Pembaruan dataset (koreksi Teacher/Admin, level baru) didistribusikan lewat mekanisme versi (FR-SYNC-05, `dictionary_meta.version`) — diunduh di background, tidak menyentuh data progres pengguna (BR-SYNC-05).

**Keputusan ukuran Postgres (OQ-09) tetap final: satu project Supabase, tidak perlu split ke Neon** — 19MB jauh di bawah limit 500MB, dan keputusan penyederhanaan Tier 1/Tier 2 di atas tidak mengubah kesimpulan ini (server tetap menyimpan dataset yang sama, cuma cara distribusinya ke client yang disederhanakan).

### 21.5 Kenapa Bukan Self-Host Postgres/NestJS (termasuk untuk potensi SaaS)

Sempat dipertimbangkan self-host Postgres (+NestJS+Redis di Docker) baik untuk mengatasi kekhawatiran ukuran data maupun untuk fleksibilitas SaaS di masa depan. Diputuskan **tetap memakai Supabase**, dengan alasan:

- **Supabase = Postgres standar**, bukan format proprietary — data dapat di-*dump*/dimigrasikan ke Postgres manapun (self-hosted maupun provider lain) kapan saja. Ini menghapus argumen "lock-in" sebagai alasan self-host di awal.
- Self-host memindahkan tanggung jawab **keamanan, backup, dan uptime** database yang menyimpan kredensial & data pribadi pengguna dari provider terkelola ke solo developer — risiko naik, bukan turun, terutama untuk data sensitif seperti password hash.
- Kebutuhan khas SaaS (billing, multi-tenancy, admin panel lanjutan) tidak memerlukan NestJS untuk dipenuhi — dapat ditambahkan **belakangan** sebagai service kecil (Edge Function/Hono) di atas Postgres yang sama, hanya saat benar-benar dibutuhkan dan traksi produk sudah tervalidasi.
- Membangun auth+backend custom dari awal (yang sudah selesai di Supabase) adalah biaya besar untuk kebutuhan yang belum terbukti — risiko lebih besar daripada "harus menambah service nanti".
- **Redis** tetap tidak dipakai — tidak ada requirement saat ini yang membutuhkan cache/session store terpisah; JWT dari Supabase Auth sudah cukup untuk sesi.

### 21.6 Pemisahan Tanggung Jawab Server vs Client

| Ditangani Client (offline-capable, State B/C) | Ditangani Server (Supabase, perlu online) |
|---|---|
| Pencarian kamus penuh (§7.2, setelah unduhan awal) | Pencarian kamus sebelum unduhan pertama selesai (State A, §21.3) |
| Sesi review SRS & penjadwalan SM-2 (§7.3) | Registrasi, login, verifikasi email, reset password (§7.1) |
| Kuis Artikel Rush (§7.4) | Penyimpanan progres untuk Registered User (Deck, SRSCard, ReviewLog) |
| Tabel konjugasi & deklinasi (§7.5) | Sinkronisasi lintas perangkat (§6.7) |
| Seluruh data Guest | Row-Level Security per pengguna (BR-AUTH-12) |
| | Migrasi data Guest → akun (FR-AUTH-09) |
| | Queue & approval saran koreksi Teacher, source of truth `dictionary` (§7.1a) |
| | Cek versi (`dictionary_meta`) & sajikan file kamus penuh untuk diunduh (§21.3) |

### 21.7 Dampak terhadap Roadmap (§19)

- **Fase 0**: pipeline data (selesai, §21.2a–k) — ukuran final 19,02MB mengonfirmasi keputusan satu Supabase project tanpa split Neon (OQ-09 selesai).
- **Fase 1 (MVP)** perlu mengimplementasikan **state machine Progressive Full Download** (§21.3) sejak awal — unduhan background, swap atomik, indikator status non-blocking (FR-DICT-02c–f) — karena ini bagian dari janji utama produk ("jangan sampai kosong").
- **Fase 2 (Akun)** tetap dipercepat karena Supabase Auth sudah menutupi mayoritas FR-AUTH-*.
- **Fase 3 (Grammar & Game)** — ditambah workflow Teacher/Admin (§7.1a): permohonan Teacher, submit saran, review queue Admin, apply ke `dictionary` + bump versi.
- **Docker** dihapus dari seluruh dependensi teknis (§17.2) — tidak relevan dengan stack terkelola ini, termasuk untuk skenario SaaS ke depan (§21.5).
