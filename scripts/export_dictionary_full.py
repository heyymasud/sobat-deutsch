import os
import psycopg2
import json
import gzip
import hashlib
import urllib.request
import urllib.error
from pathlib import Path
import sys

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
# override via env vars (or .env.local) to export from a remote (production) project.
PG_HOST = os.environ.get("PG_HOST", "127.0.0.1")
PG_PORT = int(os.environ.get("PG_PORT", "54322"))
PG_USER = os.environ.get("PG_USER", "postgres")
PG_PASSWORD = os.environ.get("PG_PASSWORD", "postgres")
PG_DB = os.environ.get("PG_DB", "postgres")

# Supabase Storage config. Defaults target local Supabase CLI;
# override via env vars (or .env.local) for a remote (production) project.
SUPABASE_URL = os.environ.get("EXPORT_SUPABASE_URL", "http://127.0.0.1:54321")
SERVICE_ROLE_KEY = os.environ.get(
    "EXPORT_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
)

EXPORT_DIR = Path(__file__).parent.parent / "data-pipeline" / "output"

def run():
    print("Connecting to Postgres...")
    pg_conn = psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        database=PG_DB
    )
    pg_curr = pg_conn.cursor()
    
    # 1. Ensure storage bucket exists
    print("Ensuring storage bucket 'dictionary-releases' exists...")
    pg_curr.execute("""
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('dictionary-releases', 'dictionary-releases', true)
        ON CONFLICT (id) DO NOTHING;
    """)
    pg_conn.commit()
    
    # 2. Get current dictionary meta version and bump it for this export
    pg_curr.execute("SELECT id, version FROM public.dictionary_meta LIMIT 1;")
    meta_id, current_version = pg_curr.fetchone()
    version = current_version + 1
    print(f"Exporting as dictionary version: {version}")
    
    # 3. Fetch all dictionary entries
    print("Fetching entries from Postgres...")
    columns = [
        "id", "lemma", "pos", "gender", "plural", "genitiv_singular", "translations",
        "example", "separable_prefix", "auxiliary", "verb_class", "ablaut_class",
        "conjugation_table", "case_governance", "comparative", "superlative",
        "level", "theme_tags", "frequency_rank",
        "ipa", "etymology", "hyphenation"
    ]
    query = f"SELECT {', '.join(columns)} FROM public.dictionary ORDER BY id ASC;"
    pg_curr.execute(query)
    rows = pg_curr.fetchall()
    
    # NFR-PERF-08: keys with a null value for these 3 low-coverage columns
    # (~15-23%) are OMITTED rather than serialized as `"ipa":null,` -- that
    # per-row overhead across all 110k+ entries alone pushed the export past
    # the +15% size cap (measured 20.76% with the key always present vs
    # 14.72% sparse, see docs/SPRINT_CHECKLIST.md S10-05 bukti). The client
    # never notices: an absent key reads as `undefined`, same falsy check as
    # `null` (entry.ipa && ...). Existing columns are untouched -- this is
    # scoped to only the 3 new low-coverage fields, not a general format change.
    SPARSE_IF_NULL = {"ipa", "etymology", "hyphenation"}

    # Convert to list of dicts
    data = []
    for r in rows:
        entry = {}
        for idx, col in enumerate(columns):
            val = r[idx]
            if val is None and col in SPARSE_IF_NULL:
                continue
            entry[col] = val
        data.append(entry)
        
    # Serialize to JSON string
    print(f"Serializing {len(data)} entries...")
    json_data = json.dumps(data, ensure_ascii=False)

    # Real content checksum (client integrity check per FR-DICT-02c/02d/02e)
    checksum = hashlib.sha256(json_data.encode("utf-8")).hexdigest()
    print(f"Checksum: {checksum}")

    # Save locally first
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    local_path = EXPORT_DIR / f"dictionary-full.v{version}.json"
    with open(local_path, "w", encoding="utf-8") as f:
        f.write(json_data)
    print(f"Saved locally to {local_path}")
    
    # 4. Upload to Supabase Storage, gzip-compressed to stay under the
    # platform's per-file upload limit (Free plan: 50MB; raw JSON is ~60MB+
    # at 110k+ rows). Content-Encoding: gzip makes browsers decompress
    # transparently on fetch/XHR -- no client code change needed.
    print("Uploading to Supabase Storage (gzip)...")
    upload_url = f"{SUPABASE_URL}/storage/v1/object/dictionary-releases/dictionary-full.v{version}.json"
    compressed = gzip.compress(json_data.encode("utf-8"), compresslevel=9)
    print(f"Compressed size: {len(compressed)} bytes (raw: {len(json_data.encode('utf-8'))} bytes)")

    req = urllib.request.Request(
        upload_url,
        data=compressed,
        headers={
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "apikey": SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
            "x-upsert": "true"
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            resp_body = response.read().decode("utf-8")
            print(f"Upload successful: {resp_body}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error during upload: {e.code} - {e.read().decode('utf-8')}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
        
    # 5. Persist the real version/checksum and clear the re-export flag
    pg_curr.execute(
        """
        UPDATE public.dictionary_meta
        SET version = %s, row_count = %s, checksum = %s,
            published_at = now(), needs_reexport = false
        WHERE id = %s;
        """,
        (version, len(data), checksum, meta_id)
    )
    pg_conn.commit()

    pg_conn.close()
    print("Export pipeline finished successfully!")

if __name__ == "__main__":
    run()
