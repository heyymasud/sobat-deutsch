"""
NFR-MNT-05: automated test untuk fungsi ekstraksi baru (IPA/etymology/
hyphenation) di normalize_dictionary.py -- pipeline ini sebelumnya tanpa
automated test sama sekali (baseline High-Risk Area), hanya gate manual
validate_dictionary.py. Dijalankan sebelum gate manual itu.
"""
import unittest

from normalize_dictionary import extract_ipa, extract_etymology, extract_hyphenation


class TestExtractIpa(unittest.TestCase):
    def test_takes_first_sound_with_ipa(self):
        entry = {"sounds": [{"audio": "x.ogg"}, {"ipa": "[haʊ̯s]"}, {"ipa": "[haʊ̯zɘ]"}]}
        self.assertEqual(extract_ipa(entry), "[haʊ̯s]")

    def test_none_when_no_sounds(self):
        self.assertIsNone(extract_ipa({}))
        self.assertIsNone(extract_ipa({"sounds": [{"audio": "x.ogg"}, {"rhymes": "-aʊ̯s"}]}))


class TestExtractEtymology(unittest.TestCase):
    def test_strips_etymology_tree_noise_keeps_sentences(self):
        raw = (
            "Etymology tree\n"
            "Proto-Indo-European *(s)kewH-der.?\n"
            "Proto-Germanic *husa\n"
            "German Haus\n"
            "From Middle High German hus, from Old High German hus, from Proto-West Germanic *hus, from Proto-Germanic *husa.\n"
            "Cognate with Old Frisian hus, Low German Hus, Huus, Dutch huis. Doublet of House."
        )
        result = extract_etymology({"etymology_text": raw})
        self.assertIn("From Middle High German hus", result)
        self.assertIn("Doublet of House.", result)
        self.assertNotIn("Etymology tree", result)
        self.assertNotIn("Proto-Germanic *husa\n", result)

    def test_plain_sentence_without_tree_prefix_kept_as_is(self):
        raw = "From Middle High German vri, Old High German fri, from Proto-West Germanic *fri. Compare Dutch vrij, English free."
        self.assertEqual(extract_etymology({"etymology_text": raw}), raw)

    def test_none_when_nothing_survives_cleaning(self):
        # Pure tree noise, no narrative sentence at all -- EC-DICT-11: fail-safe to None,
        # never show raw technical noise to the user.
        raw = "Etymology tree\nProto-Indo-European *kewH\nProto-Germanic *husa"
        self.assertIsNone(extract_etymology({"etymology_text": raw}))

    def test_none_when_field_absent(self):
        self.assertIsNone(extract_etymology({}))


class TestExtractHyphenation(unittest.TestCase):
    def test_takes_first_variant_joined_with_middle_dot(self):
        entry = {"hyphenations": [{"parts": ["De", "zem", "ber"]}]}
        self.assertEqual(extract_hyphenation(entry), "De·zem·ber")

    def test_takes_first_of_multiple_variants(self):
        # EC-DICT-12: >1 variant -- take the first, don't merge all.
        entry = {"hyphenations": [{"parts": ["ma", "chi", "nie", "ren"]}, {"parts": ["ma", "chine", "ren"]}]}
        self.assertEqual(extract_hyphenation(entry), "ma·chi·nie·ren")

    def test_none_when_absent(self):
        self.assertIsNone(extract_hyphenation({}))
        self.assertIsNone(extract_hyphenation({"hyphenations": []}))


if __name__ == "__main__":
    unittest.main()
