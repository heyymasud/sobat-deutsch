# Scratch Notes — Ide Fitur (coret-coret, belum resmi)

> Catatan diskusi bebas sebelum masuk ke `plan-feature-delta`/PRD resmi. Isi di sini BUKAN requirement final — boleh berubah, dihapus, atau dianggap gugur kapan saja. Kalau sudah matang, pindahkan ke `docs/features/<slug>-DELTA.md`.

---

## 1. Terjemahan Indonesia untuk kamus

**Masalah**: kolom `dictionary.translations` cuma berisi gloss bahasa Inggris (dari Wiktionary/Kaikki DE→EN). Tidak ada satupun data Indonesia. Search pakai kata Indonesia = 0 hasil karena datanya memang belum ada, bukan bug search.

**Konteks tambahan dari baseline**: PRD.md OQ-04 ("bahasa terjemahan: ID/EN/keduanya") ternyata masih open question yang belum pernah diputuskan resmi — jadi ini bukan cuma gap implementasi, tapi juga gap keputusan produk.

**Arah yang didiskusikan** (belum final):
- Opsi cari kamus DE-ID native → kemungkinan besar tidak realistis, dataset terbuka berkualitas untuk DE-ID nyaris tidak ada sebesar DE-EN.
- Opsi isi manual dari nol → terlalu lama untuk ~110rb lemma.
- **Arah yang dipertimbangkan (cenderung ini)**: MT (Machine Translation) batch offline dari EN→ID di `data-pipeline/`, hasilnya ditandai status draft/belum diverifikasi (mis. `translation_status: 'machine_draft'`), lalu dikoreksi bertahap lewat alur Teacher→Admin yang sudah ada. Prioritaskan kata frequency tinggi dulu (`de_freq_50k.txt` sudah ada) untuk review manual, bukan semua sekaligus.

**Blast radius yang sudah dipetakan di baseline** (lihat `docs/CODEBASE_BASELINE.md` §6):
- Kolom `translations` dipakai di ≥10 titik render — kolom bahasa baru akan menyentuh banyak file.
- Perlu ubah: migration Postgres (+ `search_vector` generated column harus di-drop & rebuild), Edge Function `dictionary-search` (hardcode nama kolom), Dexie schema versi baru, MiniSearch fields, pipeline Python, UI Admin/Teacher (hardcode daftar field yang bisa dikoreksi).
- Model full re-download (~110rb lemma) — nambah kolom = semua client re-download ulang.

**Belum diputuskan / masih didiskusikan**:
- MT pakai tool/API apa (belum dibahas konkret).
- Apakah `translations` (EN) tetap ditampilkan berdampingan dengan ID, atau ID jadi primary dan EN jadi sekunder/hilang.
- Threshold "frequency tinggi" untuk prioritas review manual berapa (top 1000? 5000?).

---

## 2. Fitur dari raw data Kaikki (hasil audit `data-pipeline/raw/kaikki-german.jsonl`)

**Konteks**: pipeline sekarang (`scripts/normalize_dictionary.py`) cuma ambil `senses[].glosses` dan `senses[].examples` dari raw Kaikki. Field lain di raw data belum dimanfaatkan. Sudah dicek coverage-nya di sample ~20rb baris (dari total 373rb baris mentah, final lemma ~110rb) untuk menilai worth-nya sebelum masuk delta resmi.

**Audio/pelafalan (`sounds.audio`, 81% coverage) — DIPUTUSKAN TIDAK DIKERJAKAN.** App sudah punya pelafalan lewat Web Speech API browser (`WordDetail.tsx:66-71`, `speechSynthesis`). Audio asli Kaikki (file ogg/mp3 Wiktionary) akan lebih natural tapi butuh hosting/download file media per kata — nabrak model local-first full-download. TTS browser dianggap cukup, tidak perlu upgrade ke audio file asli.

**3 fitur yang worth dilanjutkan ke tahap delta:**

1. **IPA teks (fonetik)**
   - Sumber: `sounds.ipa` di raw Kaikki.
   - Coverage: 22.6% dari sample.
   - Kenapa worth: field teks biasa, murah diekstrak (bukan field prosa). Pelengkap TTS — user bisa lihat cara baca fonetik, bukan cuma dengar.
   - Catatan: karena coverage cuma ~1/5 kata, ditampilkan sebagai info opsional (tampil kalau ada datanya), bukan fitur yang wajib ada di semua kata.

2. **Etymology (asal kata)**
   - Sumber: `etymology_text` di raw Kaikki.
   - Coverage: 21.2% dari sample.
   - Kenapa worth: value jelas untuk trivia/mnemonic (bantu ingat kata lewat asal-usulnya).
   - Catatan: teks panjang & prosa (beda dari field terstruktur seperti gender/plural) — effort ekstraksi/pembersihan lebih besar dibanding IPA. Kemungkinan perlu parsing tambahan sebelum ditampilkan ke user (raw etymology text Kaikki cukup teknis/linguistik).

3. **Hyphenations (pemisahan suku kata)**
   - Sumber: `hyphenations` di raw Kaikki.
   - Coverage: 14% dari sample.
   - Kenapa worth (tapi prioritas paling rendah dari 3 ini): use-case spesifik untuk fitur "eja per suku kata" — niche, coverage juga tidak tinggi.

**Field yang dicek tapi disimpulkan KURANG worth untuk fitur berdiri sendiri** (coverage terlalu tipis, dicatat di sini biar tidak dibahas ulang tanpa alasan baru):
- `topics` (4.2%), `synonyms` (6.4%), `examples` tambahan (4.7%), tag register/formalitas (3.2%) — semua <10% coverage.
- `derived`/`related` (~1.5%), `antonyms`/`hypernyms`/`hyponyms`/`meronyms`/`holonyms` (semua <1%) — terlalu jarang muncul di data.

**Belum diputuskan / ide terbuka lain:**
- Level CEFR (A1/A2/B1) di skema `dictionary.level` **bukan** dari sumber resmi — itu proxy dari `frequency_rank` (lihat `scripts/assign_level_proxy.py`), eksplisit ditandai sebagai approximation di komentar kode. Kalau mau level lebih akurat, butuh sumber wordlist CEFR resmi terpisah (mis. Goethe-Institut) — belum dicek ketersediaannya, belum masuk scope delta manapun.

## 3. Pengelompokan kata untuk kuis (ArtikelRush) — ganti CEFR yang misleading

**Masalah**: `dictionary.level` sekarang berisi label `'A1'/'A2'/'B1'` tapi itu cuma proxy dari `frequency_rank` (lihat `scripts/assign_level_proxy.py`), BUKAN data CEFR resmi. Menampilkan ini sebagai "A1/A2/B1" ke user itu **misleading** — user bisa mengira ini level resmi (kayak yang dipakai di ujian Goethe-Institut). **Keputusan: hapus/ganti label CEFR ini, jangan dipakai kalau datanya bukan CEFR asli.**

**Kebutuhan awal**: ArtikelRush sekarang random murni — kata susah dan gampang campur, bikin pemula bingung. Perlu cara pengelompokan supaya kuis bisa dikurasi (mis. mulai dari yang gampang).

**By-tema (`topics`) sudah dicek — belum bisa** (lihat §2, coverage cuma 4.2%). Kalau dipakai buat grouping utama, mayoritas kata bakal masuk kelompok "tidak ada tema" — jadi belum layak jadi sumbu utama pengelompokan.

**Opsi pengelompokan lain yang datanya SUDAH ADA (tidak perlu sumber data baru)**:

1. **By frequency (rename dari CEFR)** — ✅ Direkomendasikan sebagai sumbu utama. Data & threshold sama seperti proxy yang sudah ada (`frequency_rank`), cuma label diganti jadi jujur soal apa yang diukur — misal "Sering dipakai / Menengah / Jarang dipakai" atau "Mudah/Menengah/Sulit", bukan klaim level bahasa resmi.
2. **Regularitas gender akhiran kata** — khusus relevan buat ArtikelRush. Bahasa Jerman punya pola akhiran yang predictable gendernya (`-ung/-heit/-keit/-schaft` → hampir selalu **die**; `-chen/-lein` → hampir selalu **das**). Kata dengan pola predictable = grup "gampang", kata gender arbitrary = grup "susah". Butuh sedikit kerja bikin aturan pola akhiran, tapi field yang dibutuhkan (`lemma`, `gender`) sudah 100% ada di skema.
3. **Panjang kata / jumlah suku kata** — proxy kasar pakai panjang string `lemma` (100% coverage) atau `hyphenations` (14% coverage, lebih akurat tapi coverage rendah). Kata pendek = gampang, compound word panjang = susah.
4. **POS filter** — bukan difficulty tier, tapi fitur filter fokus latihan (mis. hanya kata benda konkret). Data `pos` 100% ada.

**Rekomendasi kombinasi**: pakai #1 (frequency) sebagai sumbu utama difficulty, opsional tambah #2 (gender regularity) khusus untuk ArtikelRush karena langsung menyasar sumber kesulitan yang relevan (bukan cuma jarang/sering dipakai, tapi predictable/tidaknya gender).

### Fitur turunan: tips prediksi gender akhiran kata

Karena berguna buat pemula, direncanakan tampil di **dua tempat sekaligus** (bukan pilih salah satu):
- **Kontekstual di ArtikelRush** — muncul sebagai hint/feedback singkat saat user salah jawab (mis. "kata berakhiran `-ung` biasanya **die**"). Lebih efektif karena muncul di momen belajar yang tepat.
- **Referensi lengkap** — di `WordDetail.tsx` sebagai info tambahan per kata, atau halaman kecil "Tips Gender" yang bisa diakses dari ArtikelRush, untuk yang mau baca aturan lengkapnya sekaligus.

Trade-off: page tersendiri gampang dilupain kalau berdiri sendiri; hint kontekstual doang tanpa referensi lengkap bikin user nggak lihat pola besarnya. Kombinasi keduanya dianggap lebih baik dari salah satu saja.

## 4. Feedback UX modul SRS/Flashcard (`src/modules/srs/*`, `src/core/srs/*`)

**Konteks**: modul SRS sudah stable & well-tested dari sisi algoritma (SM-2 di `srsScheduler.ts`), tapi ada beberapa gap dari sisi UX/manajemen kartu yang ditemukan lewat pemakaian langsung. Dicatat sebagai kandidat delta terpisah dari topik kamus.

1. **Wording rating kartu ("Lagi/Keras/Baik/Mudah") membingungkan.**
   - Lokasi: `ReviewSession.tsx:636-657`.
   - Masalah: ini terjemahan literal dari jargon Anki (Again/Hard/Good/Easy), bukan istilah natural bahasa Indonesia. User (native ID) sendiri mengaku tidak paham maksudnya.
   - Arah perbaikan: ganti wording jadi lebih deskriptif soal kondisi mengingat (mis. "Belum hafal" / "Agak susah" / "Ingat" / "Gampang banget" — bahasa tepatnya masih perlu didiskusikan), bukan terjemahan literal label SM-2 standar.

2. **Tidak bisa edit/hapus kartu individual di dalam deck.**
   - Lokasi: `DeckManager.tsx` — fitur yang ada cuma di level deck (buat, ubah nama, hapus SELURUH deck, ekspor CSV). Tidak ada aksi per-kartu (lihat/hapus satu kartu tertentu dari deck).
   - Kebutuhan: user ingin bisa membuang kartu tertentu dari deck tanpa menghapus deck secara keseluruhan.

3. **Tidak bisa browse/lihat isi deck di dalam app.**
   - Satu-satunya cara "lihat isi deck" sekarang adalah Ekspor CSV (dibaca di luar app, lewat spreadsheet) — tidak ada tampilan browse-per-kartu di UI itu sendiri.
   - Kebutuhan: user ingin bisa cek ulang isi kartu di deck (misal untuk review manual tanpa mode kuis).

4. **Tidak ada aksi "reset" progress deck.**
   - Yang ada cuma "Hapus" (destruktif, deck + semua kartu hilang permanen). Tidak ada aksi mengembalikan `interval`/`repetitions`/`easeFactor` semua kartu ke kondisi baru TANPA menghapus kartunya (mis. kalau user mau mulai ulang dari nol tapi kartu tetap ada).

5. **Akurasi sesi kurang jelas gunanya buat user.**
   - Akurasi sesi (`calculateAccuracy` — proporsi rating ≥3 dari total rating di sesi) sebenarnya untuk self-tracking progres belajar, tapi user tidak langsung paham maksudnya dari tampilan saat ini — mungkin butuh konteks tambahan (misal dibandingkan sesi sebelumnya, atau penjelasan singkat).

6. **Ekspor CSV — DIPUTUSKAN: hapus fiturnya.**
   - Isinya data mentah penjadwalan SM-2 (`Card ID, Lemma, POS, Card Type, Interval, Ease Factor, Repetitions, Due Date`) — tidak mudah dibaca manusia biasa, gunanya tidak dijelaskan di UI, user tidak paham kenapa fitur ini ada.
   - Keputusan: dihapus saja daripada dipertahankan sebagai fitur yang membingungkan. Kalau kebutuhan backup/lihat isi deck tetap ada, itu dipenuhi lewat fitur #3 (browse isi deck di dalam app) yang lebih jelas kegunaannya, bukan lewat file CSV mentah.

## 5. Search "keteteran"/kerasa rusak saat sync awal — BUG-FIX, bukan fitur baru (direklasifikasi)

> **Update**: setelah dicek lebih lanjut saat mau dibuatkan feature delta, ternyata requirement ini **sudah ada di `docs/PRD.md`** dengan status Must (`FR-DICT-02c`, `FR-DICT-02f`, `EC-SYNC-06`, `AC-DICT-01`). Jadi ini BUKAN fitur baru yang butuh FR/BR/AC ID baru — ini kasus **implementasi tidak sesuai requirement yang sudah ada** (non-conformance/bug). Diputuskan untuk dikerjakan sebagai bug-fix langsung, bukan lewat `plan-feature-delta`.

**Konteks**: waktu user baru pertama buka app, kamus offline (~110rb lemma) belum terunduh ke IndexedDB. Selama proses download berjalan, search bar terasa tidak berfungsi/lambat — first impression user mengira app rusak, padahal begitu sync selesai semuanya normal.

**Temuan penting (sudah dicek ke kode, bukan asumsi)**: arsitektur untuk menangani ini **sudah ada**, bukan perlu didesain ulang dari nol:
- `src/core/search/searchService.ts:104-181` — logic routing State A/B/C sudah eksplisit: kalau data lokal belum ada/belum terindeks, search otomatis fallback ke **Edge Function online** (State A). Baru pindah ke local search (MiniSearch) setelah `localVersion > 0 && isIndexed`.
- Jadi opsi "sync async, search pakai online dulu sampai offline selesai" itu **sudah jadi desain yang ada**, bukan ide baru.

**Kemungkinan akar masalah sebenarnya (bukan logic routing, tapi UX & performa eksekusi)**:
1. `src/core/dictSync/syncManager.ts:158-232` — proses download file (~20-30MB), `JSON.parse`, dan `bulkPut` ke IndexedDB (batch 5000 baris) semuanya jalan di **main thread**, BUKAN Web Worker. Ini kemungkinan besar penyebab UI (termasuk search bar) kerasa freeze/nge-lag selama proses sync — bukan karena state routing salah.
2. `src/modules/dictionary/components/SearchBar.tsx` — **tidak sadar sama sekali status `syncManager`** (tidak subscribe ke `downloadState`). Cuma ada loading generik per search-request, tidak ada indikator/pesan yang menjelaskan "kamus offline masih disiapkan, pencarian pakai mode online dulu". User tidak tahu ini kondisi normal/sementara, jadi mengira app rusak.

**Keputusan (user setuju)**: perbaiki 2 hal di atas, BUKAN ganti ke pendekatan "online-only + CTA manual download di profile" (opsi alternatif yang sempat dibahas tapi tidak dipilih karena effort lebih besar untuk redesign flow yang sebenarnya sudah punya fondasi benar).

**Requirement eksplisit dari user**: pastikan first impression TIDAK terasa rusak di awal — kalau pindah ke Web Worker ternyata membantu, itu boleh dilakukan sebagai bagian dari perbaikan ini (bukan wajib jadi satu-satunya solusi, tapi diizinkan kalau memang itu yang menyelesaikan freeze-nya).

**Arah perbaikan konkret untuk delta nanti**:
1. Tambahkan indikator jelas di `SearchBar` saat `downloadState !== 'idle'` (mis. banner kecil: "Menyiapkan kamus offline — pencarian pakai mode online untuk sekarang").
2. Pertimbangkan pindahkan `JSON.parse` + `bulkPut` besar di `syncManager.ts` ke Web Worker supaya tidak memblokir UI thread selama proses download/import berjalan.

**STATUS: SELESAI DIKERJAKAN** (di luar `plan-feature-delta`, langsung sebagai bug-fix karena requirement-nya sudah ada di PRD):
1. `src/core/dictSync/downloadWorker.ts` (baru) — fetch + `JSON.parse` file kamus (~20-30MB) dipindah ke Web Worker.
2. `src/core/dictSync/syncManager.ts` — pakai worker itu; sisanya (batch write) tetap main thread.
3. `src/modules/dictionary/components/SearchBar.tsx` — hint kontekstual saat sync pertama kali berjalan.
4. **Root cause kedua yang ketemu setelah user melaporkan search masih stuck di fase "verifying"**: transaksi atomic swap (`db.transaction('rw', [dictionary, dictionaryStaging, dictSyncMeta], ...)`) mengunci tabel `dictSyncMeta` selama seluruh proses copy ~110rb baris — padahal `searchDictionary()` baca tabel itu di baris pertamanya untuk menentukan routing online/offline, jadi ikut ke-block. Fix: `dictSyncMeta` dikeluarkan dari transaksi besar, diupdate di transaksi kecil terpisah setelahnya.
5. Verifikasi: `tsc -b` bersih (0 error baru), lint bersih, 82/82 test lulus (termasuk `MockWorker` baru di `syncManager.test.ts` untuk tetap bisa mock alur download).

## 6. Koreksi: halaman Profile SUDAH ADA, tidak perlu dikerjakan

Sempat dikira belum ada, tapi setelah dicek ke kode ternyata sudah lengkap dan reachable:
- `src/pages/Account.tsx` merender `src/modules/auth/components/UserProfile.tsx`, routed di `/account` (`App.tsx:34`).
- Isinya: ganti nama tampilan, ganti password (dengan verifikasi password lama), atur limit kartu harian, daftar jadi Teacher, logout, hapus akun.
- Link ke halaman ini ada di `src/layouts/AppLayout.tsx:184-192` (tombol "Akun Saya"/"Pengaturan" di layout utama).
- **Tidak perlu masuk scope delta apa pun** — dicatat di sini supaya tidak dibahas ulang tanpa alasan baru.

<!-- Tambahkan ide fitur lain di bawah sini, format bebas, sebagai H2 baru -->
