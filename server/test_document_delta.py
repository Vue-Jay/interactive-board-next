import unittest

from document_delta import (
    DeltaHistory, MAX_HISTORY_BYTES, MAX_HISTORY_ENTRIES, apply_delta,
    document_bytes_from_parts, encoded_bytes,
)


class DocumentDeltaTests(unittest.TestCase):
    def test_split_size_matches_exact_utf8_serialization(self):
        for metadata in ({}, {"version": 1, "title": "Яков\\\n😀", "ink": [{"x": -0.00001}]}):
            for items in ([], [{"id": "a"}], [{"id": "a", "value": 10**20}, {"id": "б", "v": True}]):
                size = document_bytes_from_parts(metadata, sum(map(encoded_bytes, items)), len(items))
                self.assertEqual(size, encoded_bytes({**metadata, "items": items}))

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

    def test_compact_ink_suffix_roundtrip_and_missing_base(self):
        points = [{"x": i / 10, "y": i % 5} for i in range(200)]
        ink = {"id": "ink", "kind": "pen", "x": 10, "y": 20,
               "width": 25, "height": 10, "points": points, "createdBy": "teacher"}
        base = {"version": 1, "items": [ink, {"id": "other"}]}
        edit = {"id": "ink", "count": 200, "keep": 199,
                "geometry": {"x": 9, "y": 18, "width": 27, "height": 12},
                "points": [{"x": 0, "y": 0}, {"x": 1, "y": 1}]}
        delta = {"items": {"point_edits": [edit]}}
        expected = {**ink, **edit["geometry"], "points":
                    [{"x": round(p["x"] + 1, 2), "y": p["y"] + 2} for p in points[:199]] + edit["points"]}
        self.assertEqual(apply_delta(base, delta)["items"], [expected, {"id": "other"}])
        self.assertEqual(base["items"][0], ink)
        self.assertLess(encoded_bytes(delta), encoded_bytes({"items": {"upsert": [expected]}}) // 10)
        for invalid in ({**edit, "count": 199}, {**edit, "keep": 201},
                        {**edit, "points": [{"x": True, "y": 0}]}, {**edit, "id": "other"}):
            with self.assertRaises(ValueError):
                apply_delta(base, {"items": {"point_edits": [invalid]}})
        with self.assertRaises(ValueError):
            apply_delta({"version": 1, "items": []}, delta)
        with self.assertRaises(ValueError):
            apply_delta(base, {"items": {"point_edits": [edit], "remove": ["ink"]}})

    def test_sticker_point_suffix_preserves_other_ink(self):
        a = {"id": "a", "kind": "marker", "points": [{"x": .001, "y": .002}], "weight": .1}
        b = {"id": "b", "kind": "pen", "points": [{"x": .3, "y": .4}]}
        item = {"id": "note", "kind": "sticky", "stickerInk": [a, b], "text": "note"}
        base = {"version": 1, "items": [item]}
        edit = {"id": "note", "stroke_id": "a", "count": 1, "keep": 1, "points": [{"x": -.1234567, "y": 1.2}]}
        result = apply_delta(base, {"items": {"point_edits": [edit]}})
        self.assertEqual(result["items"], [{**item, "stickerInk": [{**a, "points": a["points"] + edit["points"]}, b]}])
        self.assertEqual(item["stickerInk"], [a, b])
        with self.assertRaises(ValueError):
            apply_delta(base, {"items": {"point_edits": [{**edit, "stroke_id": "erased"}]}})

    def test_history_is_bounded_and_gap_safe(self):
        history = DeltaHistory()
        delta = {"set": {"title": "hello"}}
        history.remember("board", 2, delta)
        history.remember("board", 4, delta)
        self.assertEqual(history.chain("board", 4, 4), [])
        self.assertIsNone(history.chain("board", 1, 4))
        history.remember("board", 3, delta)
        self.assertEqual(history.chain("board", 1, 4), [delta, delta, delta])
        compact = {"items": {"point_edits": [{"id": "a"}]}}
        history.remember("board", 3, delta, compact)
        self.assertEqual(history.chain("board", 1, 4), [delta, delta, delta])
        self.assertEqual(history.chain("board", 1, 4, True), [delta, compact, delta])
        self.assertIsNone(history.chain("other", 1, 4))
        for i in range(MAX_HISTORY_ENTRIES + 1):
            history.remember("board", i + 10, {"set": {"text": "x" * 50000}})
        self.assertLessEqual(history.size, MAX_HISTORY_BYTES)
        self.assertLessEqual(len(history.entries), MAX_HISTORY_ENTRIES)
        self.assertIsNone(history.chain("board", 1, 4))


if __name__ == "__main__":
    unittest.main()
