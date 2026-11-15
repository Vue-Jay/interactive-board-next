import unittest

from document_delta import DeltaHistory, MAX_HISTORY_BYTES, MAX_HISTORY_ENTRIES, apply_delta


class DocumentDeltaTests(unittest.TestCase):
    def test_native_roundtrip(self):
        old = {"version": 1, "items": [{"id": "a", "text": "first"}, {"id": "b"}], "subject": "math"}
        patch = {"remove": ["subject"], "set": {"title": "Новая доска"}, "items": {
            "remove": ["b"], "upsert": [{"id": "a", "text": "changed"}, {"id": "c"}], "order": ["c", "a"]}}
        self.assertEqual(apply_delta(old, patch), {"version": 1, "title": "Новая доска", "items": [{"id": "c"}, {"id": "a", "text": "changed"}]})
        self.assertEqual(old["items"][0]["text"], "first")
        for invalid in (
            {"set": {"version": 2}}, {"set": {"pilot_schema": 1}},
            {"items": {"order": ["a", "a"]}}, {"items": {"remove": ["b", "b"]}},
            {"items": {"upsert": [{"id": "a"}, {"id": "a"}]}},
        ):
            with self.assertRaises(ValueError):
                apply_delta(old, invalid)

    def test_history_is_bounded_and_gap_safe(self):
        history = DeltaHistory()
        delta = {"set": {"title": "hello"}}
        history.remember("board", 2, delta)
        history.remember("board", 4, delta)
        self.assertIsNone(history.chain("board", 1, 4))
        history.remember("board", 3, delta)
        self.assertEqual(history.chain("board", 1, 4), [delta, delta, delta])
        self.assertIsNone(history.chain("other", 1, 4))
        for i in range(MAX_HISTORY_ENTRIES + 1):
            history.remember("board", i + 10, {"set": {"text": "x" * 50000}})
        self.assertLessEqual(history.size, MAX_HISTORY_BYTES)
        self.assertLessEqual(len(history.entries), MAX_HISTORY_ENTRIES)
        self.assertIsNone(history.chain("board", 1, 4))


if __name__ == "__main__":
    unittest.main()
