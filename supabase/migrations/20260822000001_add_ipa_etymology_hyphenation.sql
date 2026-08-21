-- Delta: docs/features/data-kaikki-tambahan-DELTA.md
-- Additive only: 3 kolom nullable baru, tidak ada data existing yang diubah/dihapus.

ALTER TABLE public.dictionary
  ADD COLUMN IF NOT EXISTS ipa text,
  ADD COLUMN IF NOT EXISTS etymology text,
  ADD COLUMN IF NOT EXISTS hyphenation text;

COMMENT ON COLUMN public.dictionary.ipa IS 'Transkripsi fonetik IPA dari Kaikki/Wiktionary, opsional (~22.6% coverage). FR-DICT-18.';
COMMENT ON COLUMN public.dictionary.etymology IS 'Asal-usul kata, sudah dibersihkan dari markup Wiktionary di pipeline. Opsional (~21.2% coverage). FR-DICT-19, BR-DICT-14.';
COMMENT ON COLUMN public.dictionary.hyphenation IS 'Pemisahan suku kata dipisah titik tengah (mis. "Hau·ser"), opsional (~14% coverage). FR-DICT-20.';

-- Tidak perlu ubah search_vector generated column -- field ini sengaja
-- TIDAK ikut FTS (hanya tampilan, bukan target pencarian).
