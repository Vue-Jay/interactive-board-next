"""One topology check per unique geometry, then cross-check every dated legacy map.
Results are diagnostics, not an assertion of historical sovereignty or completeness.
Usage: TIMELINE_FOLDER ARCHIVE_FOLDER REPORT.json ORIGINAL_SOURCE.geojson
"""
import hashlib
import json
import pathlib
import re
import sys
import unicodedata

import numpy as np
from pyproj import Transformer
from shapely import get_coordinates, make_valid, transform
from shapely.geometry import shape
from shapely.strtree import STRtree
from shapely.validation import explain_validity


def hash_bytes(data):
    return hashlib.sha256(data).hexdigest()


def name_key(name):
    return ' '.join(unicodedata.normalize('NFKC', name).casefold().split())


def polygons(g):
    if g.geom_type == 'Polygon':
        return [g]
    if hasattr(g, 'geoms'):
        return [p for component in g.geoms for p in polygons(component)]
    return []


def diagnostic_geometry(raw):
    g = shape(raw)
    issue = None if g.is_valid else explain_validity(g)
    # Dateline-spanning segments and polar coordinates are not safely compared
    # by a single planar projection. Preserve and flag them, never wrap by guess.
    rings = [r for p in polygons(g) for r in [p.exterior, *p.interiors]]
    dateline = any(np.any(np.abs(np.diff(get_coordinates(r)[:, 0])) > 180) for r in rings)
    polar = any(np.any(np.abs(get_coordinates(r)[:, 1]) > 86) for r in rings)
    if g.is_empty or dateline or polar:
        return None, issue, 'empty' if g.is_empty else 'dateline' if dateline else 'polar'
    if issue:
        # No automatic repair enters the historical timeline: this is only a
        # diagnostic geometry to help quantify a source discrepancy.
        g = make_valid(g)
    p = polygons(g)
    if not p:
        return None, issue, 'non-polygonal'
    from shapely.ops import unary_union
    g = unary_union(p) if len(p) > 1 else p[0]
    projected = transform(g, PROJECT.transform, interleaved=False)
    if not projected.is_valid:
        projected = make_valid(projected)
    if projected.is_empty or projected.area <= 0:
        return None, issue, 'zero-area'
    return projected, issue, None


PROJECT = Transformer.from_crs('EPSG:4326', 'EPSG:6933', always_xy=True)


def audit(folder, archive, output, original_source):
    manifest = json.loads((folder / 'manifest.json').read_text())
    registry = json.loads((folder / 'change-review-registry.json').read_text())
    assert registry['source']['sha256'] == manifest['source']['sha256']
    geom, topology, records, repaired = {}, {}, {}, {}
    for block in manifest['blocks']:
        data = (folder / block['file']).read_bytes()
        assert hash_bytes(data) == block['sha256']
        pack = json.loads(data)
        for key, raw in pack['geometries'].items():
            if key in topology:
                continue
            projected, invalid, excluded = diagnostic_geometry(raw)
            topology[key] = {'invalid': invalid, 'comparisonExcluded': excluded,
                             'areaKm2': round(projected.area / 1e6, 6) if projected is not None else None}
            if projected is not None:
                geom[key] = projected
        for r in pack['records']:
            assert r['id'] not in records or records[r['id']] == r
            records[r['id']] = r
            if r.get('sourceGeometryId'):
                repaired[r['sourceIndex']] = pack['geometries'][r['geometryId']]
    assert len(topology) == manifest['counts']['uniqueGeometries']
    assert len(records) == manifest['counts']['revisions']
    # Independent GEOS equivalence against the immutable input, not the JS
    # repair implementation. Dropping zero-area retracings cannot move land.
    original_bytes = original_source.read_bytes()
    assert hash_bytes(original_bytes) == manifest['source']['sha256']
    original = json.loads(original_bytes)
    from shapely.ops import unary_union
    for index, raw in repaired.items():
        before = shape(original['features'][index]['geometry'])
        after = shape(raw)
        assert not before.is_valid and after.is_valid
        assert after.equals(unary_union(polygons(make_valid(before)))), f'Repair changed areal geometry at {index}'
    del original, original_bytes
    affected = {}
    for unit in registry['reviewUnits']:
        t = topology[unit['geometryId']]
        if t['invalid'] or t['comparisonExcluded']:
            affected.setdefault(unit['geometryId'], []).append({'unitId': unit['id'], 'entityId': unit['entityId'], 'name': unit['name'], 'intervals': unit['intervals']})
    print(f'Topology: {len(topology)} unique contours; {sum(t["invalid"] is not None for t in topology.values())} invalid; {len(affected)} need review', flush=True)
    snapshots = []
    # Use exactly the independently pinned snapshot set, not nearby dates.
    # One overlap comparison per real pair of source polygons.
    pairs = {}
    for filename in sorted(archive.glob('world_*.geojson')):
        match = re.fullmatch(r'world_(bc)?(\d+)\.geojson', filename.name)
        if not match:
            continue
        year = int(match[2]) * (-1 if match[1] else 1)
        if not manifest['from'] <= year <= manifest['to']:
            continue
        data = filename.read_bytes()
        active = [r for r in records.values() if r['from'] <= year <= r['to'] and r['geometryId'] in geom and r['geometryStatus'] != 'rejected']
        shapes = [geom[r['geometryId']] for r in active]
        tree = STRtree(shapes)
        rows = []
        for i, feature in enumerate(json.loads(data)['features']):
            raw = feature.get('geometry') or {}
            if raw.get('type') not in ('Polygon', 'MultiPolygon'):
                continue
            name = str((feature.get('properties') or {}).get('NAME') or '')
            polygon, invalid, excluded = diagnostic_geometry(raw)
            row = {'archiveIndex': i, 'archiveName': name, 'archiveInvalid': invalid, 'comparisonExcluded': excluded}
            candidates = []
            if polygon is not None:
                archive_hash = hash_bytes(json.dumps(raw, separators=(',', ':')).encode())
                for j in tree.query(polygon, predicate='intersects'):
                    r = active[j]
                    key = (archive_hash, r['geometryId'])
                    if key not in pairs:
                        other = shapes[j]
                        inter = polygon.intersection(other).area
                        union = polygon.area + other.area - inter
                        pairs[key] = (inter / union if union else 0, inter / polygon.area, inter / other.area)
                    iou, old_fraction, candidate_fraction = pairs[key]
                    if iou <= 0:
                        continue
                    exact_name = bool(name) and name_key(name) in (name_key(r['name']), name_key(r['sourceName']))
                    candidates.append({'revisionId': r['id'], 'entityId': r['entityId'], 'geometryId': r['geometryId'], 'name': r['name'], 'exactName': exact_name, 'iou': round(iou, 6), 'archiveFraction': round(old_fraction, 6), 'candidateFraction': round(candidate_fraction, 6)})
            candidates.sort(key=lambda c: c['iou'], reverse=True)
            exact = [c for c in candidates if c['exactName']]
            row['bestSpatialCandidates'] = candidates[:3]
            row['exactNamedCandidates'] = exact
            row['status'] = 'excluded' if polygon is None else 'named-high-overlap' if exact and exact[0]['iou'] >= .85 else 'named-disagreement' if exact else 'spatial-only' if candidates else 'no-spatial-match'
            rows.append(row)
        counts = {status: sum(r['status'] == status for r in rows) for status in sorted({r['status'] for r in rows})}
        snapshots.append({'year': year, 'file': filename.name, 'sha256': hash_bytes(data), 'counts': counts, 'rows': rows})
    snapshots.sort(key=lambda s: s['year'], reverse=True)
    report = {'source': manifest['source'], 'method': 'EPSG:6933; exact source-name equality plus spatial overlap; no automatic historical identity or boundary approval; invalid polygons made valid for diagnostic comparison only',
              'counts': {'uniqueGeometries': len(topology), 'invalidGeometries': sum(t['invalid'] is not None for t in topology.values()), 'excludedGeometries': sum(bool(t['comparisonExcluded']) for t in topology.values()), 'equivalentRepairs': len(repaired), 'affectedReviewUnits': sum(map(len, affected.values())), 'snapshots': len(snapshots), 'archivePolygons': sum(len(s['rows']) for s in snapshots), 'uniqueSpatialPairs': len(pairs)},
              'topology': topology, 'affectedReviewUnits': affected, 'snapshots': snapshots}
    output.write_text(json.dumps(report, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps(report['counts']), flush=True)
    assert not report['counts']['invalidGeometries'], 'Candidate topology regression: inspect report'
    return report


if __name__ == '__main__':
    assert len(sys.argv) == 5, 'TIMELINE_FOLDER ARCHIVE_FOLDER REPORT.json ORIGINAL_SOURCE.geojson'
    audit(*map(pathlib.Path, sys.argv[1:]))
