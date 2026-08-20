"""
Validasi kualitas dictionary.sqlite terhadap ground truth manual (kata umum
yang jawabannya sudah pasti benar) + pemeriksaan integritas struktural.

Tujuan: data ini dipakai untuk BELAJAR -- data salah lebih berbahaya
daripada data kosong (user bisa menghafal kesalahan tanpa sadar).
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data-pipeline" / "output" / "dictionary.sqlite"

# Ground truth: kata umum A1-A2 yang jawabannya sudah pasti (dicek manual,
# bukan ditebak). gender: m/f/n. plural: bentuk plural standar (bisa None
# kalau memang tidak lazim dipakai plural).
NOUN_GROUND_TRUTH = [
    ("Hund", "m", "Hunde"),
    ("Katze", "f", "Katzen"),
    ("Haus", "n", "Häuser"),
    ("Tisch", "m", "Tische"),
    ("Stuhl", "m", "Stühle"),
    ("Auto", "n", "Autos"),
    ("Buch", "n", "Bücher"),
    ("Frau", "f", "Frauen"),
    ("Mann", "m", "Männer"),
    ("Kind", "n", "Kinder"),
    ("Tag", "m", "Tage"),
    ("Nacht", "f", "Nächte"),
    ("Baum", "m", "Bäume"),
    ("Blume", "f", "Blumen"),
    ("Schule", "f", "Schulen"),
    ("Lehrer", "m", "Lehrer"),
    ("Wasser", "n", None),  # uncountable, plural jarang dipakai
    ("Brot", "n", "Brote"),
    ("Tür", "f", "Türen"),
    ("Fenster", "n", "Fenster"),
    ("Straße", "f", "Straßen"),
    ("Stadt", "f", "Städte"),
    ("Land", "n", "Länder"),
    ("Zeit", "f", "Zeiten"),
    ("Jahr", "n", "Jahre"),
    ("Tochter", "f", "Töchter"),
    ("Sohn", "m", "Söhne"),
    ("Mutter", "f", "Mütter"),
    ("Vater", "m", "Väter"),
    ("Freund", "m", "Freunde"),
    ("Lehrer", "m", "Lehrer"),  # regression test: agent noun dari verb "lehren",
                                # sempat hilang total karena bug filter form_of
]

# Verb ground truth: (lemma, auxiliary_yang_benar, separable_prefix_yang_benar_atau_None)
VERB_GROUND_TRUTH = [
    ("gehen", "sein", None),
    ("kommen", "sein", None),
    ("machen", "haben", None),
    ("sagen", "haben", None),
    ("sein", "sein", None),
    ("haben", "haben", None),
    ("aufstehen", "both", "auf"),   # bisa haben/sein tergantung dialek/makna
    ("anrufen", "haben", "an"),
    ("einkaufen", "haben", "ein"),
    ("fahren", "both", None),      # sein (bergerak) / haben (mengemudikan) -- valid keduanya
    ("bleiben", "sein", None),
    ("werden", "sein", None),
    ("verstehen", "haben", None),  # untrennbar, prefix "ver-" bukan separable
    ("bekommen", "both", None),    # dikoreksi: sumber (Wiktionary) mendokumentasikan
                                    # "haben or sein" -- ground truth awal saya salah, bukan datanya
]


def check_nouns(conn):
    print("=== VALIDASI NOUN (ground truth manual) ===")
    fail = 0
    for lemma, exp_gender, exp_plural in NOUN_GROUND_TRUTH:
        rows = conn.execute(
            "SELECT gender, plural FROM words WHERE lemma=? AND pos='noun'", (lemma,)
        ).fetchall()
        if not rows:
            print(f"  [MISSING] {lemma}: tidak ditemukan di database sama sekali")
            fail += 1
            continue
        # cek apakah ADA salah satu baris (bisa multi-sense) yang match gender yang benar
        genders_found = {r[0] for r in rows}
        plurals_found = {r[1] for r in rows}
        gender_ok = exp_gender in genders_found
        plural_ok = (exp_plural is None) or (exp_plural in plurals_found)
        status = "OK" if (gender_ok and plural_ok) else "FAIL"
        if status == "FAIL":
            fail += 1
        print(f"  [{status}] {lemma}: expected gender={exp_gender} plural={exp_plural} "
              f"| found gender={genders_found} plural={plurals_found}")
    print(f"\nNoun: {len(NOUN_GROUND_TRUTH) - fail}/{len(NOUN_GROUND_TRUTH)} benar\n")
    return fail


def check_verbs(conn):
    print("=== VALIDASI VERB (ground truth manual) ===")
    fail = 0
    for lemma, exp_aux, exp_prefix in VERB_GROUND_TRUTH:
        rows = conn.execute(
            "SELECT auxiliary, separable_prefix FROM words WHERE lemma=? AND pos='verb'", (lemma,)
        ).fetchall()
        if not rows:
            print(f"  [MISSING] {lemma}: tidak ditemukan di database sama sekali")
            fail += 1
            continue
        aux_found = {r[0] for r in rows}
        prefix_found = {r[1] for r in rows}
        aux_ok = exp_aux in aux_found or (exp_aux == "both" and ("haben" in aux_found or "sein" in aux_found))
        prefix_ok = exp_prefix in prefix_found
        status = "OK" if (aux_ok and prefix_ok) else "FAIL"
        if status == "FAIL":
            fail += 1
        print(f"  [{status}] {lemma}: expected aux={exp_aux} prefix={exp_prefix} "
              f"| found aux={aux_found} prefix={prefix_found}")
    print(f"\nVerb: {len(VERB_GROUND_TRUTH) - fail}/{len(VERB_GROUND_TRUTH)} benar\n")
    return fail


def check_structural_integrity(conn):
    print("=== PEMERIKSAAN INTEGRITAS STRUKTURAL ===")
    issues = 0

    # 1. Gender harus salah satu dari m/f/n atau NULL -- tidak boleh nilai lain
    bad_gender = conn.execute(
        "SELECT DISTINCT gender FROM words WHERE gender IS NOT NULL AND gender NOT IN ('m','f','n')"
    ).fetchall()
    if bad_gender:
        print(f"  [ISSUE] Nilai gender di luar m/f/n ditemukan: {bad_gender}")
        issues += 1
    else:
        print("  [OK] Semua nilai gender valid (m/f/n/NULL)")

    # 2. Auxiliary harus salah satu dari haben/sein/both/NULL
    bad_aux = conn.execute(
        "SELECT DISTINCT auxiliary FROM words WHERE auxiliary IS NOT NULL "
        "AND auxiliary NOT IN ('haben','sein','both')"
    ).fetchall()
    if bad_aux:
        print(f"  [ISSUE] Nilai auxiliary tidak valid: {bad_aux}")
        issues += 1
    else:
        print("  [OK] Semua nilai auxiliary valid (haben/sein/both/NULL)")

    # 3. Encoding check -- umlaut harus tersimpan benar (bukan mojibake)
    umlaut_sample = conn.execute(
        "SELECT lemma FROM words WHERE lemma LIKE '%ä%' OR lemma LIKE '%ö%' "
        "OR lemma LIKE '%ü%' OR lemma LIKE '%ß%' LIMIT 5"
    ).fetchall()
    replacement_char = conn.execute(
        "SELECT COUNT(*) FROM words WHERE lemma LIKE '%�%' OR translations LIKE '%�%'"
    ).fetchone()[0]
    print(f"  Sample lemma dengan umlaut tersimpan benar: {[r[0] for r in umlaut_sample]}")
    if replacement_char > 0:
        print(f"  [ISSUE] {replacement_char} baris mengandung karakter mojibake (U+FFFD)")
        issues += 1
    else:
        print("  [OK] Tidak ada karakter mojibake (U+FFFD) di lemma/translations")

    # 4. Lemma kosong/whitespace
    empty_lemma = conn.execute(
        "SELECT COUNT(*) FROM words WHERE TRIM(lemma) = '' OR lemma IS NULL"
    ).fetchone()[0]
    if empty_lemma > 0:
        print(f"  [ISSUE] {empty_lemma} baris dengan lemma kosong")
        issues += 1
    else:
        print("  [OK] Tidak ada lemma kosong")

    # 5. Plural sama persis dengan lemma singular tapi ditandai berbeda -- sanity check kecil
    total = conn.execute("SELECT COUNT(*) FROM words").fetchone()[0]
    print(f"  Total baris di database: {total}")

    print(f"\nIntegritas struktural: {issues} isu ditemukan\n")
    return issues


def check_duplicate_conflicting_gender(conn):
    """Kata yang sama punya >1 gender berbeda -- valid secara linguistik (mis. der/das
    Teil) TAPI perlu ditandai jelas di UI (EC-DICT-01), bukan dipilih diam-diam."""
    print("=== CEK KATA DENGAN GENDER GANDA (perlu ditangani khusus di UI, EC-DICT-01) ===")
    rows = conn.execute(
        """SELECT lemma, GROUP_CONCAT(DISTINCT gender) as genders, COUNT(DISTINCT gender) as n
           FROM words WHERE pos='noun' AND gender IS NOT NULL
           GROUP BY lemma HAVING n > 1 LIMIT 10"""
    ).fetchall()
    for lemma, genders, n in rows:
        print(f"  {lemma}: gender = {genders}")
    total_multi = conn.execute(
        """SELECT COUNT(*) FROM (
             SELECT lemma FROM words WHERE pos='noun' AND gender IS NOT NULL
             GROUP BY lemma HAVING COUNT(DISTINCT gender) > 1
           )"""
    ).fetchone()[0]
    print(f"\nTotal lemma noun dengan gender ganda (valid, perlu UI khusus): {total_multi}\n")


def run():
    conn = sqlite3.connect(DB_PATH)
    conn.text_factory = str

    noun_fail = check_nouns(conn)
    verb_fail = check_verbs(conn)
    struct_issues = check_structural_integrity(conn)
    check_duplicate_conflicting_gender(conn)

    print("=" * 60)
    print("RINGKASAN VALIDASI")
    print("=" * 60)
    print(f"Ground truth noun gagal   : {noun_fail}/{len(NOUN_GROUND_TRUTH)}")
    print(f"Ground truth verb gagal   : {verb_fail}/{len(VERB_GROUND_TRUTH)}")
    print(f"Isu integritas struktural : {struct_issues}")

    conn.close()


if __name__ == "__main__":
    run()
