"""
Enrichment lanjutan untuk verba: conjugation_table, verb_class, ablaut_class.
Blocker Sprint 5 (docs/SPRINT_PLAN.md S5-00) -- kolom ini ADA di skema tapi
belum diisi pipeline v1 (dicatat eksplisit di Architecture §4.1 & §5).

Sumber data: raw/kaikki-german.jsonl, forms[] dengan source='conjugation'
(sudah diverifikasi lengkap: Präsens/Präteritum/Perfekt tersedia per lemma,
tidak perlu sumber tambahan).

case_governance TIDAK ditangani di sini -- kaikki.org tidak punya data ini
sama sekali (diverifikasi manual pada 'warten'/'helfen'/'singen', tidak ada
kategori atau field terkait Rektion). Ditangani terpisah lewat kurasi
manual (scripts/verb_case_governance.py), bukan diekstrak dari sumber ini.
"""

import json
import re
import sqlite3
from pathlib import Path

RAW_PATH = Path(__file__).parent.parent / "data-pipeline" / "raw" / "kaikki-german.jsonl"
DB_PATH = Path(__file__).parent.parent / "data-pipeline" / "output" / "dictionary.sqlite"

PERSON_MAP = {
    ("first-person", "singular"): "ich",
    ("first-person", "plural"): "wir",
    ("second-person", "singular"): "du",
    ("second-person", "plural"): "ihr",
    ("third-person", "singular"): "er_sie_es",
    ("third-person", "plural"): "sie_Sie",
}

DIPHTHONGS = ["ie", "ei", "au", "eu", "äu"]
VOWELS = ["a", "e", "i", "o", "u", "ä", "ö", "ü"]


def person_key(tags):
    tagset = set(tags)
    for (person, number), key in PERSON_MAP.items():
        if person in tagset and number in tagset:
            return key
    return None


def extract_verb_class(entry):
    """Ambil langsung dari forms[] bertag table-tags (mis. 'strong'/'weak'/'irregular strong')."""
    for f in entry.get("forms") or []:
        if f.get("tags") == ["table-tags"]:
            form = (f.get("form") or "").strip().lower()
            if "irregular" in form and "strong" in form:
                return "irregular"
            if "strong" in form:
                return "strong"
            if "weak" in form:
                return "weak"
            if "mixed" in form:
                return "mixed"
    return None


def extract_conjugation_table(entry):
    """
    Bangun {praesens, praeteritum, perfekt} dari forms[] bertag source='conjugation'.
    Return None kalau tidak ada form conjugation sama sekali (mis. modal verb
    yang tabelnya berbeda struktur -- ditangani manual nanti, bukan dipaksakan).
    """
    table = {"praesens": {}, "praeteritum": {}, "perfekt": {}}
    found_any = False

    for f in entry.get("forms") or []:
        if f.get("source") != "conjugation":
            continue
        tags = set(f.get("tags") or [])
        if "subjunctive" in tags or "subjunctive-i" in tags or "subjunctive-ii" in tags:
            continue  # v1 cuma indikatif -- subjunctive/konjunktiv di luar scope FR-GRAM-01
        if "indicative" not in tags:
            continue

        key = person_key(f.get("tags") or [])
        if not key:
            continue

        if "present" in tags and "future" not in tags:
            table["praesens"][key] = f.get("form")
            found_any = True
        elif "preterite" in tags:
            table["praeteritum"][key] = f.get("form")
            found_any = True
        elif "perfect" in tags and "multiword-construction" in tags and "pluperfect" not in tags:
            table["perfekt"][key] = f.get("form")
            found_any = True

    return table if found_any else None


def find_vowel(word):
    """
    Heuristik: ambil vokal/diftong PERTAMA pada kata (akar kata kerja Jerman
    umumnya bersuku satu dalam bentuk principal parts yang disediakan sumber,
    mis. "sang", "gesungen" -> heuristik ini cukup untuk mengelompokkan pola,
    BUKAN klaim linguistik presisi -- didokumentasikan sebagai pendekatan,
    lihat catatan di PRD/Architecture.
    """
    w = word.lower()
    i = 0
    while i < len(w):
        for d in DIPHTHONGS:
            if w[i:i + len(d)] == d:
                return d
        if w[i] in VOWELS:
            return w[i]
        i += 1
    return "?"


def extract_ablaut_class(entry, verb_class):
    """
    Hanya dihitung untuk verb_class strong/irregular (weak verbs tidak ablaut).
    Pola diambil dari head_templates['de-verb'].args['1'], format:
    "singen<sang,gesungen,sänge>" -> vokal infinitiv-preteritum-partisip.
    """
    if verb_class not in ("strong", "irregular"):
        return None

    for head in entry.get("head_templates") or []:
        if head.get("name") != "de-verb":
            continue
        arg1 = (head.get("args") or {}).get("1", "")
        m = re.match(r"^([a-zA-ZäöüßÄÖÜ]+)<([^,>]+),([^,>]+)", arg1)
        if not m:
            continue
        infinitive, preterite, participle = m.group(1), m.group(2), m.group(3)
        # partisip biasanya "ge-" + akar kata (mis. "gegangen") -- tanpa
        # melewati prefix ini, heuristik salah ambil vokal dari "ge-" itu
        # sendiri, bukan vokal akar (bug ditemukan: gehen sempat dapat
        # "e-i-e" alih-alih pola akar yang benar). Verba berprefix
        # terpisah/tidak terpisah (mis. "verstanden", "aufgegangen") masih
        # jadi limitasi residual -- tidak ditangani di v1, skala kecil.
        participle_root = participle[2:] if participle.lower().startswith("ge") else participle
        v1, v2, v3 = find_vowel(infinitive), find_vowel(preterite), find_vowel(participle_root)
        if "?" in (v1, v2, v3):
            return None
        return f"{v1}-{v2}-{v3}"
    return None


def run():
    conn = sqlite3.connect(DB_PATH)
    cols = {row[1] for row in conn.execute("PRAGMA table_info(words)")}
    for col, coltype in (("verb_class", "TEXT"), ("ablaut_class", "TEXT"), ("conjugation_table", "TEXT")):
        if col not in cols:
            conn.execute(f"ALTER TABLE words ADD COLUMN {col} {coltype}")

    verb_lemmas = {row[0] for row in conn.execute("SELECT DISTINCT lemma FROM words WHERE pos='verb'")}
    print(f"Total verb lemma di database: {len(verb_lemmas)}")

    updated = 0
    conj_filled = 0
    ablaut_filled = 0
    total_read = 0

    with open(RAW_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("pos") != "verb":
                continue
            word = entry.get("word")
            if word not in verb_lemmas:
                continue
            total_read += 1

            verb_class = extract_verb_class(entry)
            conj_table = extract_conjugation_table(entry)
            ablaut = extract_ablaut_class(entry, verb_class)

            if conj_table:
                conj_filled += 1
            if ablaut:
                ablaut_filled += 1

            conn.execute(
                """UPDATE words SET verb_class = ?, ablaut_class = ?, conjugation_table = ?
                   WHERE lemma = ? AND pos = 'verb'""",
                (verb_class, ablaut, json.dumps(conj_table, ensure_ascii=False) if conj_table else None, word),
            )
            updated += 1

            if updated % 2000 == 0:
                conn.commit()
                print(f"  ... {updated} verb diproses")

    conn.commit()
    conn.execute("VACUUM")

    total_verb = len(verb_lemmas)
    print("\n=== Ringkasan Enrichment Verba ===")
    print(f"Baris verb diproses (match dictionary)  : {updated}")
    print(f"conjugation_table terisi                : {conj_filled} ({100*conj_filled/total_verb:.1f}%)")
    print(f"ablaut_class terisi (dari verb strong)   : {ablaut_filled}")

    conn.close()


if __name__ == "__main__":
    run()
