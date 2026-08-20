"""
Proxy level CEFR (A1/A2/B1) dari frequency_rank -- BUKAN klasifikasi resmi
Goethe-Institut, didokumentasikan jujur sebagai heuristik (PRD §21.2d catatan
"belum dikerjakan", SPRINT_PLAN.md §15 blocker).

Threshold dipilih berdasarkan praktik umum: ~2000 kata pertama korpus
frekuensi tinggi biasanya mencakup kosakata dasar A1, 2000-4000 mendekati A2,
4000-6000 mendekati B1. Ini APPROXIMATION, bukan kebenaran linguistik --
kata frekuensi tinggi tidak selalu "mudah" (mis. kata fungsi vs kata benda
konkret), dan sebaliknya. Dipakai untuk memenuhi FR-DICT-10/FR-QUIZ-08
sebagai v1, dengan rencana penggantian ke sumber CEFR asli (mis. wordlist
Goethe-Institut) di iterasi berikutnya bila presisi level formal dibutuhkan.

Kata tanpa frequency_rank (mayoritas -- kata jarang/nama diri) sengaja
dibiarkan level=NULL, BUKAN didorong ke B1 secara default -- konsisten
dengan BR-DICT-07 (jangan tampilkan seolah lengkap kalau memang tidak tahu).
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data-pipeline" / "output" / "dictionary.sqlite"

THRESHOLDS = [
    (2000, "A1"),
    (4000, "A2"),
    (6000, "B1"),
]


def run():
    conn = sqlite3.connect(DB_PATH)
    cols = {row[1] for row in conn.execute("PRAGMA table_info(words)")}
    if "level" not in cols:
        conn.execute("ALTER TABLE words ADD COLUMN level TEXT")

    for max_rank, level in THRESHOLDS:
        conn.execute(
            "UPDATE words SET level = ? WHERE frequency_rank IS NOT NULL AND frequency_rank <= ? AND level IS NULL",
            (level, max_rank),
        )

    conn.commit()

    print("=== Distribusi level (proxy dari frequency_rank) ===")
    for row in conn.execute("SELECT level, COUNT(*) FROM words WHERE level IS NOT NULL GROUP BY level ORDER BY level"):
        print(row)
    total = conn.execute("SELECT COUNT(*) FROM words").fetchone()[0]
    with_level = conn.execute("SELECT COUNT(*) FROM words WHERE level IS NOT NULL").fetchone()[0]
    print(f"\nTotal lemma: {total}, dengan level: {with_level} ({100*with_level/total:.1f}%)")
    print("Sisanya level=NULL (kata di luar top 6000 frequency_rank, atau tanpa frequency_rank sama sekali)")

    conn.close()


if __name__ == "__main__":
    run()
