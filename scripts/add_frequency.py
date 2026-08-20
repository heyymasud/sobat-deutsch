"""
Tambahkan frequency_rank ke dictionary.sqlite dari daftar frekuensi
hermitdave/FrequencyWords (corpus subtitle, MIT license, de_50k.txt).

ponytail: matching sederhana case-insensitive by lemma. Kata majemuk/idiom
dengan spasi tidak akan match (frequency list ini per-token) -- itu batas
yang diketahui, bukan bug; cukup untuk memprioritaskan kartu baru SRS.
"""

import sqlite3
from pathlib import Path

FREQ_PATH = Path(__file__).parent.parent / "data-pipeline" / "raw" / "de_freq_50k.txt"
DB_PATH = Path(__file__).parent.parent / "data-pipeline" / "output" / "dictionary.sqlite"


def load_frequency():
    """
    Percobaan awal audit: exact-case matching untuk noun (menghindari 2.375
    pasangan homograf beda-kapitalisasi berbagi rank, mis. noun "Abarbeiten"
    vs verb "abarbeiten"). DIBATALKAN setelah diukur -- de_freq_50k.txt
    (korpus subtitle) ternyata HAMPIR SELURUHNYA huruf kecil ("haus", bukan
    "Haus"), sehingga mensyaratkan exact-case untuk noun menghancurkan
    ~15.000 match yang sah demi mencegah ~2.375 collision kecil (net lebih
    buruk). Kembali ke lowercase-uniform -- collision homograf itu memang
    keterbatasan sumber data (bukan bug pipeline), berdampak kecil karena
    frequency_rank cuma dipakai untuk urutan pengenalan kartu SRS, bukan
    fakta tata bahasa. Lihat §21.2i PRD.
    """
    rank_by_word = {}
    with open(FREQ_PATH, encoding="utf-8") as f:
        for rank, line in enumerate(f, start=1):
            parts = line.strip().split(" ")
            if not parts or not parts[0]:
                continue
            word = parts[0].lower()
            if word not in rank_by_word:
                rank_by_word[word] = rank
    return rank_by_word


def run():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("ALTER TABLE words ADD COLUMN frequency_rank INTEGER")

    rank_by_word = load_frequency()
    matched = 0
    total = 0
    for row_id, lemma in conn.execute("SELECT id, lemma FROM words"):
        total += 1
        rank = rank_by_word.get(lemma.lower())
        if rank is not None:
            conn.execute("UPDATE words SET frequency_rank = ? WHERE id = ?", (rank, row_id))
            matched += 1

    conn.execute("CREATE INDEX IF NOT EXISTS idx_words_freq ON words(frequency_rank)")
    conn.commit()
    conn.execute("VACUUM")

    size_mb = DB_PATH.stat().st_size / (1024 * 1024)
    print(f"Total lemma          : {total}")
    print(f"Dapat frequency_rank : {matched} ({100*matched/total:.1f}%)")
    print(f"Ukuran DB setelah tambah kolom: {size_mb:.2f} MB")

    print("\n=== Top 20 lemma berdasarkan frequency_rank (harus kata umum) ===")
    for row in conn.execute(
        "SELECT lemma, pos, frequency_rank FROM words WHERE frequency_rank IS NOT NULL "
        "ORDER BY frequency_rank ASC LIMIT 20"
    ):
        print(row)

    conn.close()


if __name__ == "__main__":
    run()
