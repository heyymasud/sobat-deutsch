import sqlite3
import psycopg2
from psycopg2.extras import execute_values
import sys
import os
import hashlib
from pathlib import Path
import json

DB_SQLITE_PATH = Path(__file__).parent.parent / "data-pipeline" / "output" / "dictionary.sqlite"

# ponytail: no dotenv dep -- load .env.local by hand, real env vars still win.
_env_path = Path(__file__).parent.parent / ".env.local"
if _env_path.exists():
    for line in _env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())

# Postgres connection details. Defaults target local Supabase CLI;
# override via env vars (or .env.local) to import into a remote (production) project.
PG_HOST = os.environ.get("PG_HOST", "127.0.0.1")
PG_PORT = int(os.environ.get("PG_PORT", "54322"))
PG_USER = os.environ.get("PG_USER", "postgres")
PG_PASSWORD = os.environ.get("PG_PASSWORD", "postgres")
PG_DB = os.environ.get("PG_DB", "postgres")

def run():
    if not DB_SQLITE_PATH.exists():
        print(f"SQLite file not found at {DB_SQLITE_PATH}", file=sys.stderr)
        sys.exit(1)
        
    print("Connecting to SQLite...")
    sqlite_conn = sqlite3.connect(DB_SQLITE_PATH)
    sqlite_curr = sqlite_conn.cursor()
    
    print("Connecting to Postgres...")
    pg_conn = psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        database=PG_DB
    )
    pg_curr = pg_conn.cursor()
    
    # 1. Truncate existing dictionary table
    print("Truncating dictionary table in Postgres...")
    pg_curr.execute("TRUNCATE TABLE public.dictionary RESTART IDENTITY CASCADE;")
    
    # 2. Fetch data from SQLite
    print("Fetching words from SQLite...")
    sqlite_curr.execute("""
        SELECT lemma, pos, gender, plural, translations, example,
               separable_prefix, auxiliary, frequency_rank, verb_class,
               ablaut_class, conjugation_table, case_governance, level,
               ipa, etymology, hyphenation
        FROM words
    """)
    
    rows = sqlite_curr.fetchall()
    total_rows = len(rows)
    print(f"Total rows to import: {total_rows}")
    
    # 3. Batch insert into Postgres
    insert_query = """
        INSERT INTO public.dictionary (
            lemma, pos, gender, plural, translations, example,
            separable_prefix, auxiliary, frequency_rank, verb_class,
            ablaut_class, conjugation_table, case_governance, level,
            ipa, etymology, hyphenation
        ) VALUES %s
    """
    
    batch_size = 5000
    batch = []
    inserted = 0
    
    # Compute checksum of the data
    hasher = hashlib.md5()
    
    for row in rows:
        lemma, pos, gender, plural, translations, example, separable_prefix, auxiliary, \
        frequency_rank, verb_class, ablaut_class, conjugation_table, case_governance, level, \
        ipa, etymology, hyphenation = row
        
        # Convert separable_prefix to text
        sep_pref = str(separable_prefix) if separable_prefix is not None else None
        
        # Convert case_governance to text[]
        if case_governance is not None:
            case_gov = [case_governance]
        else:
            case_gov = None
            
        # Frequency rank: cast to int if not None
        freq_rank = int(frequency_rank) if frequency_rank is not None else None
            
        # Update hash
        hasher.update(f"{lemma or ''}|{pos or ''}|{translations or ''}".encode('utf-8'))
        
        batch.append((
            lemma, pos, gender, plural, translations, example,
            sep_pref, auxiliary, freq_rank, verb_class,
            ablaut_class, conjugation_table, case_gov, level,
            ipa, etymology, hyphenation
        ))
        
        if len(batch) >= batch_size:
            execute_values(pg_curr, insert_query, batch)
            inserted += len(batch)
            print(f"  Imported {inserted}/{total_rows}...")
            batch = []
            
    if batch:
        execute_values(pg_curr, insert_query, batch)
        inserted += len(batch)
        print(f"  Imported {inserted}/{total_rows}...")
        
    checksum = hasher.hexdigest()
    print(f"Import completed. Total rows inserted: {inserted}. Checksum: {checksum}")
    
    # 4. Update dictionary_meta
    print("Updating dictionary_meta...")
    pg_curr.execute("DELETE FROM public.dictionary_meta;")
    pg_curr.execute("""
        INSERT INTO public.dictionary_meta (version, published_at, row_count, checksum)
        VALUES (%s, now(), %s, %s)
    """, (1, inserted, checksum))
    
    pg_conn.commit()
    
    sqlite_conn.close()
    pg_conn.close()
    print("Done!")

if __name__ == "__main__":
    run()
