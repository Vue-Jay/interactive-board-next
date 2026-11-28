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
from historical_atlas_name_union import compare_named_unions


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
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    registry = json.loads((folder / 'change-review-registry.json').read_text(encoding='utf-8'))
    assert registry['source']['sha256'] == manifest['source']['sha256']
    geom, topology, records, repaired, selections, partitions, adjustments, coastlines = {}, {}, {}, {}, {}, {}, {}, {}
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
            base_id = r.get('boundaryAdjustment', {}).get('baseGeometryId', r['geometryId'])
            if r.get('boundaryAdjustment'):
                adjustments[r['id']] = (r, pack['geometries'][r['geometryId']],
                                       pack['geometries'][base_id],
                                       [pack['geometries'][c['cutGeometryId']] for c in r['boundaryAdjustment']['cuts']])
            if r.get('geometryRepair') == 'reviewed-map-partition':
                partitions[r['id']] = (r, pack['geometries'][base_id],
                                       pack['geometries'][r['mapPartition']['outlineGeometryId']])
            elif r.get('geometryRepair') in ('reviewed-source-components', 'reviewed-union-source-components', 'reviewed-difference-source-components'):
                selections[r['id']] = (r, pack['geometries'][base_id])
            elif r.get('modernCoastline'):
                coastlines[r['geometryId']] = (r, pack['geometries'][base_id])
            elif r.get('sourceGeometryId'):
                repaired[r['sourceIndex']] = pack['geometries'][base_id]
    assert len(topology) == manifest['counts']['uniqueGeometries']
    assert len(records) == manifest['counts']['revisions']
    # Independent GEOS equivalence against the immutable input, not the JS
    # repair implementation. Dropping zero-area retracings cannot move land.
    original_bytes = original_source.read_bytes()
    assert hash_bytes(original_bytes) == manifest['source']['sha256']
    original = json.loads(original_bytes)
    from shapely.ops import unary_union
    if coastlines:
        coastline_file = pathlib.Path(__file__).resolve().parents[1] / 'docs/historical-atlas-modern-island-geometries-20261128.json'
        policy = json.loads(coastline_file.read_text(encoding='utf-8'))
        entries = {d['iso']: d for d in policy['entries']}
        for revision, raw in coastlines.values():
            e = revision['modernCoastline']
            assert e['datasetHash'] == policy['source']['sha256'] and e['url'] == policy['source']['url']
            entry = entries[e['iso']]
            assert revision['sourceGeometryId'] == entry['originalGeometryId'] and e['neId'] == entry['neId']
            before = polygons(shape(original['features'][revision['sourceIndex']]['geometry']))
            after = shape(raw)
            external = shape(entry['geometry'])
            assert after.is_valid and external.is_valid and after.covers(external), f'Invalid generalized coastline {e["iso"]}'
            extras = polygons(after)[len(polygons(external)):]
            assert len(extras) == e['keptDisjointSourceIslands']
            for part in extras:
                assert any(part.equals(p) for p in before) and part.intersection(external).area == 0
    for index, raw in repaired.items():
        before = shape(original['features'][index]['geometry'])
        after = shape(raw)
        assert not before.is_valid and after.is_valid, f'Invalid topology repair at {index}'
        assert after.equals(unary_union(polygons(make_valid(before)))), f'Repair changed areal geometry at {index}'
    temporal_witness_checks = set()

    def selected_part(revision, part):
        feature = original['features'][part['index']]
        geometry = polygons(shape(feature['geometry']))[part['part']]
        if feature['properties']['FromYear'] <= revision['from'] <= revision['to'] <= feature['properties']['ToYear']:
            return geometry
        witnesses = [w for w in revision.get('geometryTemporalWitnesses', [])
                     if w['before'] == part and w['year'] == revision['from'] == revision['to']]
        assert len(witnesses) == 1, f'Undocumented out-of-period source part at {revision["sourceIndex"]}'
        w = witnesses[0]
        before, after = original['features'][w['before']['index']], original['features'][w['after']['index']]
        assert before['properties']['ToYear'] == w['year'] - 1
        assert after['properties']['FromYear'] == w['year'] + 1
        following = polygons(shape(after['geometry']))[w['after']['part']]
        assert geometry.equals(following), f'Temporal witness changed outline at {revision["sourceIndex"]}'
        temporal_witness_checks.add((revision['id'], part['index'], part['part']))
        return geometry

    for revision, raw in selections.values():
        parts = []
        for part in revision['geometryParts']:
            parts.append(selected_part(revision, part))
        after = shape(raw)
        expected = unary_union(parts)
        if revision.get('geometryRepair') == 'reviewed-difference-source-components':
            for part in revision['geometrySubtractions']:
                expected = expected.difference(selected_part(revision, part))
            # Independent clipping engines may differ at floating-point intersections.
            assert after.is_valid and after.symmetric_difference(expected).area < 1e-10, f'Invalid subtraction at {revision["sourceIndex"]}'
        else:
            # polygon-clipping and GEOS can order/split union intersections
            # differently at machine precision too (not only subtraction).
            # Use the same small area tolerance as the independent difference
            # check above; invalid geometry still fails unconditionally.
            assert after.is_valid and after.symmetric_difference(expected).area < 1e-10, f'Component selection changed geometry at {revision["sourceIndex"]}'
    # A dated cartographic partition intentionally changes the source area; it
    # must never be classified as an area-preserving topology repair. Verify
    # its own outline and provenance independently with GEOS instead.
    partition_groups, subset_checks, dated_coastlines = {}, 0, 0
    for revision, raw, outline_raw in partitions.values():
        after, outline = shape(raw), shape(outline_raw)
        label = f'{revision["sourceIndex"]}/{revision["from"]}/{revision["to"]}'
        assert after.is_valid and not after.is_empty, f'Invalid map partition at {label}'
        assert outline.is_valid and not outline.is_empty, f'Invalid partition outline at {label}'
        assert revision['mapPartition']['evidence'] in revision['review']['sources']
        assert revision['geometryParts'], f'Missing source parts at {label}'
        for part in revision['geometryParts']:
            feature = original['features'][part['index']]
            assert feature['properties']['FromYear'] <= revision['from'] <= revision['to'] <= feature['properties']['ToYear']
            assert part['part'] < len(polygons(shape(feature['geometry'])))
        if revision['mapPartition'].get('kind') == 'documented-island':
            # A separately sourced generalized coastline is not constrained to
            # the original coarse shoreline. Its exact coordinates and dated
            # attribution are checked by the annual source test, not invented
            # or accepted here through an inappropriate subset assertion.
            dated_coastlines += 1
        else:
            assert after.difference(outline).area < 1e-10, f'Partition outside outline at {label}'
            subset_checks += 1
        if 'kind' not in revision['mapPartition']:
            key = (revision['mapPartition']['outlineGeometryId'], revision['from'], revision['to'])
            partition_groups.setdefault(key, []).append(after)
    for key, parts in partition_groups.items():
        outline = shape(next(outline for r, _, outline in partitions.values()
                             if (r['mapPartition']['outlineGeometryId'], r['from'], r['to']) == key))
        assert len(parts) == 3, f'Incomplete three-way map partition at {key}'
        for i, a in enumerate(parts):
            for b in parts[i + 1:]:
                assert a.intersection(b).area < 1e-10, f'Overlapping map partition at {key}'
        assert unary_union(parts).symmetric_difference(outline).area < 1e-10, f'Partition lost land at {key}'
    snapped_adjustments = 0
    for revision, raw, base, cuts in adjustments.values():
        expected = shape(base).difference(unary_union([shape(c) for c in cuts]))
        if revision['boundaryAdjustment'].get('exhausted'):
            assert expected.is_empty and revision['geometryStatus'] == 'rejected'
        else:
            after = shape(raw)
            assert after.is_valid, f'Invalid boundary adjustment at {revision["sourceIndex"]}'
            if after.symmetric_difference(expected).area >= 1e-10:
                # partitionHistoricalGeometry retries failed sweep operations
                # on a documented 1e-6-degree grid. Independently reproduce
                # that grid with JS Math.round's tie rule; do not widen the
                # area tolerance or accept an unexplained discrepancy.
                def snap(raw):
                    return transform(shape(raw), lambda xy: np.floor(xy * 1e6 + .5) / 1e6)
                expected = snap(base).difference(unary_union([snap(c) for c in cuts]))
                assert after.symmetric_difference(expected).area < 1e-10, f'Boundary adjustment changed geometry at {revision["sourceIndex"]}'
                snapped_adjustments += 1
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
        active = [r for r in records.values() if r['from'] <= year <= r['to'] and r['geometryId'] in geom and r['geometryStatus'] != 'rejected' and r['role'] == 'polity']
        shapes = [geom[r['geometryId']] for r in active]
        tree = STRtree(shapes)
        rows = []
        named_archive_rows = []
        for i, feature in enumerate(json.loads(data)['features']):
            raw = feature.get('geometry') or {}
            if raw.get('type') not in ('Polygon', 'MultiPolygon'):
                continue
            name = str((feature.get('properties') or {}).get('NAME') or '')
            polygon, invalid, excluded = diagnostic_geometry(raw)
            row = {'archiveIndex': i, 'archiveName': name, 'archiveInvalid': invalid, 'comparisonExcluded': excluded}
            named_archive_rows.append({'archiveIndex': i, 'archiveName': name, 'polygon': polygon, 'comparisonExcluded': excluded})
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
                    # Use the year-effective reviewed name only. The raw sourceName is
                    # provenance, not proof of the historical name on this date.
                    exact_name = bool(name) and name_key(name) == name_key(r['name'])
                    # Diagnostic only: original imported name is retrospective
                    # provenance, not independent proof of a historically
                    # correct country label or a surveyed source frontier.
                    alias_only = (not exact_name and bool(name) and
                                  name_key(name) == name_key(r['sourceName']))
                    candidates.append({'revisionId': r['id'], 'entityId': r['entityId'],
                                       'geometryId': r['geometryId'], 'name': r['name'],
                                       'exactName': exact_name, 'sourceAliasOnly': alias_only,
                                       'iou': round(iou, 6), 'archiveFraction': round(old_fraction, 6),
                                       'candidateFraction': round(candidate_fraction, 6)})
            candidates.sort(key=lambda c: c['iou'], reverse=True)
            exact = [c for c in candidates if c['exactName']]
            row['bestSpatialCandidates'] = candidates[:3]
            row['exactNamedCandidates'] = exact
            row['retrospectiveAliasCandidates'] = [c for c in candidates if c['sourceAliasOnly']]
            row['retrospectiveAliasWithoutEffectiveMatch'] = bool(
                row['retrospectiveAliasCandidates'] and not exact)
            row['status'] = 'excluded' if polygon is None else 'named-high-overlap' if exact and exact[0]['iou'] >= .85 else 'named-disagreement' if exact else 'spatial-only' if candidates else 'no-spatial-match'
            rows.append(row)
        named_unions = compare_named_unions(named_archive_rows, active, geom, name_key)
        grouped_by_index = {index: group for group in named_unions for index in group['archiveIndices']}
        false_fragment_alerts = sum(
            row['status'] == 'named-disagreement' and
            grouped_by_index.get(row['archiveIndex'], {}).get('status') == 'named-union-high-overlap'
            for row in rows)
        counts = {status: sum(r['status'] == status for r in rows) for status in sorted({r['status'] for r in rows})}
        snapshots.append({'year': year, 'file': filename.name, 'sha256': hash_bytes(data),
                          'counts': counts, 'rows': rows,
                          'namedUnionComparisons': named_unions,
                          'fragmentAlertsClearedByNamedUnion': false_fragment_alerts,
                          'retrospectiveAliasWithoutEffectiveMatch': sum(
                              x['retrospectiveAliasWithoutEffectiveMatch'] for x in rows)})
    snapshots.sort(key=lambda s: s['year'], reverse=True)
    union_diagnostics = {
        'comparedNameYears': sum(len(s['namedUnionComparisons']) for s in snapshots),
        'highOverlapNameYears': sum(sum(x['status'] == 'named-union-high-overlap' for x in s['namedUnionComparisons']) for s in snapshots),
        'disagreementNameYears': sum(sum(x['status'] == 'named-union-disagreement' for x in s['namedUnionComparisons']) for s in snapshots),
        'incompleteArchiveNameYears': sum(sum(x['status'] == 'incomplete-archive-geometry' for x in s['namedUnionComparisons']) for s in snapshots),
        'falseFragmentAlertsCleared': sum(s['fragmentAlertsClearedByNamedUnion'] for s in snapshots),
        'rawSourceAliasOnlyArchiveFeatures': sum(
            s['retrospectiveAliasWithoutEffectiveMatch'] for s in snapshots),
        'ambiguousSameNameNameYears': sum(sum(x['ambiguousAtlasIdentities'] for x in s['namedUnionComparisons']) for s in snapshots),
    }
    report = {'source': manifest['source'], 'method': 'EPSG:6933; legacy per-feature IoU plus independent both-sided year-effective exact-name polygon unions; neither is historical proof of territorial borders; invalid source repairs are diagnostic only',
              'counts': {'uniqueGeometries': len(topology), 'invalidGeometries': sum(t['invalid'] is not None for t in topology.values()), 'excludedGeometries': sum(bool(t['comparisonExcluded']) for t in topology.values()), 'equivalentRepairs': len(repaired), 'reviewedComponentSelections': len(selections), 'reviewedModernIslandOutlines': len(coastlines), 'reviewedMapPartitions': len(partitions), 'partitionSubsetChecks': subset_checks, 'datedCoastlinePartitions': dated_coastlines, 'completeThreeWayPartitions': len(partition_groups), 'affectedReviewUnits': sum(map(len, affected.values())), 'snapshots': len(snapshots), 'archivePolygons': sum(len(s['rows']) for s in snapshots), 'uniqueSpatialPairs': len(pairs)},
              'topology': topology, 'affectedReviewUnits': affected, 'namedUnionDiagnostics': union_diagnostics, 'snapshots': snapshots}
    output.write_text(json.dumps(report, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'counts': report['counts'], 'namedUnionDiagnostics': union_diagnostics}), flush=True)
    assert not report['counts']['invalidGeometries'], 'Candidate topology regression: inspect report'
    return report


if __name__ == '__main__':
    assert len(sys.argv) == 5, 'TIMELINE_FOLDER ARCHIVE_FOLDER REPORT.json ORIGINAL_SOURCE.geojson'
    audit(*map(pathlib.Path, sys.argv[1:]))
