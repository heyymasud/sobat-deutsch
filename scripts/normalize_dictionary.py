"""
Pipeline normalisasi kamus Jerman: kaikki.org JSONL -> SQLite terstruktur.

Ekstrak hanya field yang dibutuhkan aplikasi (PRD §12.2):
  noun:  lemma, gender, plural, level(?), pos, translations, example
  verb:  lemma, pos, translations, separable_prefix, auxiliary, example
  other: lemma, pos, translations

ponytail: ambil field seadanya dari struktur wiktextract yang tersedia;
tidak mencoba merekonstruksi data yang memang tidak ada (mis. genitiv,
ablaut_class) di tahap ini -- itu enrichment lanjutan, bukan bagian
ekstraksi dasar.
"""

import json
import sqlite3
import sys
from pathlib import Path

RAW_PATH = Path(__file__).parent.parent / "data-pipeline" / "raw" / "kaikki-german.jsonl"
DB_PATH = Path(__file__).parent.parent / "data-pipeline" / "output" / "dictionary.sqlite"

import re

GENDER_CHARS = {"m", "f", "n"}
ANGLE_BRACKET_RE = re.compile(r"<([^>]*)>")


def extract_gender(entry):
    """
    Genus nomina Jerman diambil dari head_templates, dalam salah satu dari
    TIGA format berbeda (ditemukan bertahap lewat audit §21.2f/g PRD):
      1. de-noun, "m,es:s,e:regionally"     -> token pertama sebelum koma
      2. de-noun, frasa dengan >1 bracket, mis. "aktueller<+> Geldkurs<m,es,e>"
         -> genus ada di bracket noun UTAMA, bukan selalu bracket pertama
         (bracket pertama bisa milik kata sifat pendamping, mis. "<+>")
      3. template "head" generik dengan args['g'] langsung, mis. frasa
         "saurer Regen" -> {"g": "m"} (tidak pakai template de-noun sama sekali)

    TIDAK diambil dari forms[].tags karena tag gender di sana milik bentuk
    terkait (mis. diminutive/for-the-animal), bukan genus lemma itu sendiri
    -- ini bug yang sempat membuat "Hund" (der, m) tersimpan sebagai "n".
    """
    for head in (entry.get("head_templates") or []):
        args = head.get("args") or {}
        if head.get("name") == "de-noun":
            arg1 = args.get("1", "")
            brackets = ANGLE_BRACKET_RE.findall(arg1)
            if brackets:
                for b in brackets:
                    token = b.split(",")[0].strip()
                    if token and token[0] in GENDER_CHARS:
                        return token[0]
            else:
                token = arg1.split(",")[0].strip().lstrip("(<")
                if token and token[0] in GENDER_CHARS:
                    # ponytail: kasus multi-genus (mis. "m:n") diambil genus
                    # pertama saja; enrichment tampilkan keduanya bisa menyusul.
                    return token[0]
        # fallback: template apa pun (termasuk "head" generik) yang punya
        # args['g'] langsung, dipakai wiktextract untuk frasa adjektif+noun
        g = args.get("g")
        if g in GENDER_CHARS:
            return g
    return None


def extract_plural(entry):
    """
    Prioritaskan plural standar; lewati dulu yang eksplisit ditandai
    rare/uncommon/dated oleh sumber sendiri, baru fallback ke situ kalau
    tidak ada plural standar sama sekali. Bug sebelumnya mengambil form
    PERTAMA bertag "plural" tanpa mempedulikan tag ini, sehingga varian
    langka (mis. "Verdachte") terambil duluan daripada yang standar
    ("Verdächte") -- ditemukan lewat audit pipeline (§21.2i PRD).
    """
    fallback = None
    for f in (entry.get("forms") or []):
        tags = f.get("tags") or []
        if "plural" not in tags or "canonical" in tags:
            continue
        form = f.get("form")
        if not form or form == "-":
            continue
        if "rare" in tags or "uncommon" in tags or "dated" in tags:
            if fallback is None:
                fallback = form
            continue
        return form
    return fallback


META_GLOSS_RE = re.compile(
    r"^(alternative (form|spelling) of|obsolete (form|spelling) of|"
    r"misspelling of|nonstandard (form|spelling) of|"
    r"dated (form|spelling) of|superseded spelling of|rare (form|spelling) of|"
    r"archaic (form|spelling) of|colloquial (form|spelling) of|"
    r"poetic (form|spelling) of|dialectal (form|spelling) of|"
    r".{0,40} standard spelling of|"       # mis. "Switzerland and Liechtenstein standard spelling of X"
    r"formerly standard spelling of|"      # mis. "Formerly standard spelling of X which was deprecated..."
    r"inflection of|inflected form of)\b", # jaring pengaman -- seharusnya sudah kena is_inflected_form,
                                            # tapi form_of tidak selalu terisi di sumber (§21.2i PRD)
    re.IGNORECASE,
)
# CATATAN: "contraction of" (mis. "im" = "contraction of in + dem") SENGAJA
# tidak difilter -- itu informasi gramatikal berguna untuk pembelajar, beda
# dari catatan ejaan usang/regional yang murni noise (§21.2j PRD).


def extract_translations(entry, limit=3):
    """
    Ambil gloss sebagai arti kata, TAPI lewati gloss yang sebenarnya cuma
    metadata ejaan (mis. "alternative form of neu", "obsolete spelling of
    komplex") -- sense semacam ini sering TIDAK punya field form_of terisi
    di wiktextract, sehingga lolos is_inflected_form() dan tersimpan seolah
    itu ARTI kata, padahal itu catatan ejaan usang/alternatif. Bug ini
    ditemukan lewat audit pipeline (§21.2i PRD) -- berdampak ke 4,3% baris.
    """
    glosses = []
    for sense in (entry.get("senses") or []):
        for g in (sense.get("glosses") or []):
            if META_GLOSS_RE.match(g.strip()):
                continue
            glosses.append(g)
        if len(glosses) >= limit:
            break
    return " | ".join(glosses[:limit]) if glosses else None


def extract_example(entry):
    for sense in (entry.get("senses") or []):
        for ex in (sense.get("examples") or []):
            text = ex.get("text")
            if text:
                return text
    return None


def extract_separable_prefix(entry):
    """
    head_templates['de-verb'].args['1'] format: "auf.stehen<...>" jika separable
    (prefix sebelum SATU titik), atau "gehen<...>" jika tidak (tanpa titik).

    HATI-HATI: titik di sini kadang dipakai sebagai pemisah SUKU KATA
    (hyphenation), bukan penanda prefix -- mis. "ma.chi.nie.ren" (4 suku
    kata, verba TIDAK separable) sempat salah tersimpan prefix="ma". Verba
    separable asli hanya pernah punya SATU titik (prefix.stem), jadi kalau
    ada >1 titik ini kemungkinan besar silabifikasi, bukan prefix -- lebih
    aman kembalikan None (tidak tahu) daripada prefix yang salah/tidak
    lengkap (mis. "wiedergutmachen" sempat hanya tersimpan "wieder", bagian
    "gut" hilang). Ditemukan lewat audit pipeline (§21.2i PRD).
    """
    for head in (entry.get("head_templates") or []):
        if head.get("name") != "de-verb":
            continue
        arg1 = (head.get("args") or {}).get("1", "")
        left = arg1.split("<")[0]
        dots = left.count(".")
        if dots == 1:
            return left.split(".")[0]
    return None


INFLECTION_TAGS = {
    # deklinasi nomina/adjektiva
    "nominative", "genitive", "dative", "accusative",
    "singular", "plural", "comparative", "superlative",
    # konjugasi verba -- ditambahkan setelah audit menemukan ribuan bentuk
    # terkonjugasi (Partizip, Imperativ, Präteritum, dst) leaked sebagai
    # baris "lemma verb" palsu karena vocabulary tag noun & verb berbeda
    # (§21.2f/§21.2g PRD)
    "imperative", "present", "past", "participle", "preterite",
    "subjunctive-i", "subjunctive-ii",
    "first-person", "second-person", "third-person",
    # zu-infinitive (mis. "einzuhalten" turunan dari "einhalten") -- pola
    # kedua yang leaked, ditemukan lewat investigasi lanjutan gap auxiliary
    "infinitive", "infinitive-zu",
    # ditemukan lewat audit pipeline (§21.2i PRD): sense dengan gloss
    # "inflection of X" tapi tag ini belum masuk whitelist, mis. "spie"
    # (Präteritum dari "speien") bocor sebagai lemma verba palsu
    "imperfect", "indicative", "conjunctive",
}


def is_inflected_form(entry):
    """
    Buang HANYA bentuk terinfleksi murni (mis. "Hunde" = plural dari "Hund"),
    ditandai senses[].form_of DENGAN tag gramatikal (nominative/plural/dst).
    Bentuk itu sudah terwakili sebagai field `plural` di lemma induknya.

    JANGAN buang entri turunan yang independen (mis. "Lehrer" = agent noun
    dari "lehren") walau sama-sama punya form_of -- itu lemma sendiri yang
    perlu dicari & punya gender/plural sendiri. Bedanya: sense tags-nya
    tidak mengandung penanda infleksi gramatikal (mis. tag "agent").
    Bug ini sempat membuat "Lehrer" hilang total dari dictionary -- ketahuan
    lewat validasi ground-truth (scripts/validate_dictionary.py).
    """
    has_form_of = False
    for sense in (entry.get("senses") or []):
        if not sense.get("form_of"):
            continue
        has_form_of = True
        tags = set(sense.get("tags") or [])
        if not (tags & INFLECTION_TAGS):
            return False  # ada sense turunan independen -> pertahankan seluruh entri
    return has_form_of


def extract_auxiliary(entry):
    """forms[] berisi entri {"form": "sein"/"haben", "tags": ["auxiliary"]}."""
    aux = []
    for f in (entry.get("forms") or []):
        if f.get("tags") == ["auxiliary"]:
            form = f.get("form")
            if form in ("haben", "sein") and form not in aux:
                aux.append(form)
    if not aux:
        return None
    return "both" if len(aux) > 1 else aux[0]


def init_db(conn):
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma TEXT NOT NULL,
            pos TEXT,
            gender TEXT,
            plural TEXT,
            translations TEXT,
            example TEXT,
            separable_prefix INTEGER,
            auxiliary TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_words_lemma ON words(lemma);
        CREATE VIRTUAL TABLE IF NOT EXISTS words_fts USING fts5(
            lemma, translations, content='words', content_rowid='id'
        );
        """
    )


def run(limit=None):
    if not RAW_PATH.exists():
        print(f"File mentah belum ada: {RAW_PATH}", file=sys.stderr)
        sys.exit(1)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    total = 0
    inserted = 0
    skipped_no_pos = 0
    skipped_inflected = 0

    with open(RAW_PATH, "r", encoding="utf-8") as f:
        for line in f:
            total += 1
            if limit and total > limit:
                break
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            pos = entry.get("pos")
            lemma = entry.get("word")
            # Wiktionary sendiri kadang menandai pos='noun' di level teratas
            # padahal head_templates-nya 'de-proper noun' (nama diri/toponim,
            # mis. "Eurozone") -- reklasifikasi ke 'name' spy tidak diperlakukan
            # sama seperti noun biasa (nama diri tidak perlu artikel diajarkan
            # dengan cara sama). Ditemukan lewat audit lanjutan (§21.2j PRD).
            if pos == "noun" and any(
                h.get("name") == "de-proper noun" for h in (entry.get("head_templates") or [])
            ):
                pos = "name"
            if not lemma or not pos:
                skipped_no_pos += 1
                continue
            if is_inflected_form(entry):
                skipped_inflected += 1
                continue

            gender = extract_gender(entry) if pos == "noun" else None
            plural = extract_plural(entry) if pos == "noun" else None
            translations = extract_translations(entry)
            example = extract_example(entry)
            separable = extract_separable_prefix(entry) if pos == "verb" else None
            auxiliary = extract_auxiliary(entry) if pos == "verb" else None

            conn.execute(
                """INSERT INTO words
                   (lemma, pos, gender, plural, translations, example, separable_prefix, auxiliary)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (lemma, pos, gender, plural, translations, example, separable, auxiliary),
            )
            inserted += 1

            if inserted % 20000 == 0:
                conn.commit()
                print(f"  ... {inserted} entri diproses ({total} baris dibaca)")

    conn.commit()
    conn.execute("INSERT INTO words_fts(rowid, lemma, translations) SELECT id, lemma, translations FROM words")
    conn.commit()
    conn.execute("VACUUM")
    conn.close()

    size_mb = DB_PATH.stat().st_size / (1024 * 1024)
    print("\n=== Ringkasan Pipeline ===")
    print(f"Total baris dibaca      : {total}")
    print(f"Entri disisipkan (lemma): {inserted}")
    print(f"Dilewati (tanpa pos/lemma): {skipped_no_pos}")
    print(f"Dilewati (bentuk terinfleksi/form_of): {skipped_inflected}")
    print(f"Ukuran database final   : {size_mb:.2f} MB")
    print(f"Lokasi                  : {DB_PATH}")


if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    run(limit=limit)
