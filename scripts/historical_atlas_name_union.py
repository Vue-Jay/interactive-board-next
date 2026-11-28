"""One-year, two-sided union of equally named historic polygons (GEOS)."""
from collections import defaultdict
from shapely.ops import unary_union


def compare_named_unions(archive_rows, active, geometries, name_key, threshold=0.85):
    """Geometric diagnostics only, never proof of sovereignty or borders."""
    archived, excluded, candidates = defaultdict(list), defaultdict(list), defaultdict(list)
    for row in archive_rows:
        key = name_key(row['archiveName'])
        if not key:
            continue
        if row['polygon'] is None:
            excluded[key].append(row['archiveIndex'])
        else:
            archived[key].append(row)
    for revision in active:
        key = name_key(revision['name'])  # The YEAR-EFFECTIVE title, never sourceName.
        if key and revision['geometryId'] in geometries:
            candidates[key].append(revision)
    result = []
    for key in sorted(archived.keys() & candidates.keys()):
        old, revisions = archived[key], candidates[key]
        old_union = unary_union([row['polygon'] for row in old])
        geometry_ids = sorted({r['geometryId'] for r in revisions})
        new_union = unary_union([geometries[g] for g in geometry_ids])
        intersection = old_union.intersection(new_union).area
        union_area = old_union.area + new_union.area - intersection
        iou = intersection / union_area if union_area > 0 else 0
        identities = sorted({r['entityId'] for r in revisions})
        result.append({
            'archiveName': old[0]['archiveName'],
            'archiveIndices': sorted(row['archiveIndex'] for row in old),
            'excludedArchiveIndices': sorted(excluded[key]),
            'atlasRevisionIds': sorted({r['id'] for r in revisions}),
            'atlasEntityIds': identities,
            'atlasGeometryIds': geometry_ids,
            'archivePolygonCount': len(old),
            'atlasPolygonCount': len(geometry_ids),
            'iou': round(iou, 6),
            'archiveFraction': round(intersection / old_union.area, 6),
            'candidateFraction': round(intersection / new_union.area, 6),
            'status': ('incomplete-archive-geometry' if excluded[key] else
                       'named-union-high-overlap' if iou >= threshold else
                       'named-union-disagreement'),
            'ambiguousAtlasIdentities': len(identities) > 1,
            'metricIsDiagnosticOnly': True,
        })
    return result
