"""
Kurasi manual verb+preposisi+kasus (Rektion) untuk verba paling umum diajarkan
di kursus A1-B2. kaikki.org TIDAK punya data ini sama sekali (diverifikasi
langsung -- dicek "warten"/"helfen"/"singen", tidak ada field/kategori terkait
Rektion di raw dump), jadi ini BUKAN ekstraksi dari sumber, melainkan daftar
kurasi -- fakta linguistik yang stabil & terbatas, dipakai di setiap buku
kursus Jerman, bukan konten berhak cipta yang perlu izin.

ponytail: daftar ini sengaja terbatas ke verba yang PALING sering diajarkan
(cakupan A1-B2) -- bukan usaha mencakup semua ~11.000 verba di database.
BR-DICT-07 tetap berlaku: verba di luar daftar ini punya case_governance
NULL, ditangani UI sebagai "tidak tersedia", bukan ditebak.
Tambahkan entri baru di sini kapan saja tanpa perlu re-run pipeline lain.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data-pipeline" / "output" / "dictionary.sqlite"

# lemma -> list kombinasi preposisi+kasus (bisa lebih dari satu makna/pola)
VERB_CASE_GOVERNANCE = {
    "warten": ["auf+Akk"],
    "freuen": ["auf+Akk", "über+Akk"],
    "denken": ["an+Akk"],
    "erinnern": ["an+Akk"],
    "glauben": ["an+Akk"],
    "gewöhnen": ["an+Akk"],
    "teilnehmen": ["an+Dat"],
    "leiden": ["an+Dat", "unter+Dat"],
    "achten": ["auf+Akk"],
    "verlassen": ["auf+Akk"],
    "hoffen": ["auf+Akk"],
    "konzentrieren": ["auf+Akk"],
    "vorbereiten": ["auf+Akk"],
    "interessieren": ["für+Akk"],
    "entscheiden": ["für+Akk"],
    "sorgen": ["für+Akk"],
    "danken": ["für+Akk"],
    "bedanken": ["für+Akk"],
    "bestehen": ["aus+Dat"],
    "gehören": ["zu+Dat"],
    "riechen": ["nach+Dat"],
    "schmecken": ["nach+Dat"],
    "fragen": ["nach+Dat"],
    "erkundigen": ["nach+Dat"],
    "suchen": ["nach+Dat"],
    "träumen": ["von+Dat"],
    "verabschieden": ["von+Dat"],
    "abhängen": ["von+Dat"],
    "sprechen": ["über+Akk", "mit+Dat"],
    "diskutieren": ["über+Akk"],
    "ärgern": ["über+Akk"],
    "beschweren": ["über+Akk", "bei+Dat"],
    "lachen": ["über+Akk"],
    "nachdenken": ["über+Akk"],
    "helfen": ["+Dat"],
    "gratulieren": ["+Dat", "zu+Dat"],
    "gefallen": ["+Dat"],
    "gehorchen": ["+Dat"],
    "vertrauen": ["+Dat"],
    "widersprechen": ["+Dat"],
    "folgen": ["+Dat"],
    "passen": ["+Dat"],
    "beginnen": ["mit+Dat"],
    "anfangen": ["mit+Dat"],
    "aufhören": ["mit+Dat"],
    "rechnen": ["mit+Dat"],
    "beschäftigen": ["mit+Dat"],
    "streiten": ["mit+Dat", "über+Akk"],
    "telefonieren": ["mit+Dat"],
    "einladen": ["zu+Dat"],
    "beitragen": ["zu+Dat"],
    "kämpfen": ["für+Akk", "gegen+Akk"],
    "wehren": ["gegen+Akk"],
    "protestieren": ["gegen+Akk"],
    "verzichten": ["auf+Akk"],
    "hinweisen": ["auf+Akk"],
    "reagieren": ["auf+Akk"],
    "antworten": ["auf+Akk", "+Dat"],
    "bewerben": ["um+Akk"],
    "bitten": ["um+Akk"],
    "kümmern": ["um+Akk"],
}


def run():
    conn = sqlite3.connect(DB_PATH)
    cols = {row[1] for row in conn.execute("PRAGMA table_info(words)")}
    if "case_governance" not in cols:
        conn.execute("ALTER TABLE words ADD COLUMN case_governance TEXT")

    matched = 0
    unmatched = []
    for lemma, patterns in VERB_CASE_GOVERNANCE.items():
        clean_lemma = lemma.rstrip("012")  # buang suffix disambiguasi (helfen2 dst)
        value = "|".join(patterns)
        cur = conn.execute(
            "UPDATE words SET case_governance = ? WHERE lemma = ? AND pos = 'verb'",
            (value, clean_lemma),
        )
        if cur.rowcount > 0:
            matched += cur.rowcount
        else:
            unmatched.append(clean_lemma)

    conn.commit()
    print(f"Verba dengan case_governance terisi: {matched}")
    if unmatched:
        print(f"Tidak ditemukan di database (cek ejaan/lemma): {unmatched}")
    conn.close()


if __name__ == "__main__":
    run()
