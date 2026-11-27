"""Synthetic regression: archive/atlas country fragments must be united."""
from shapely.geometry import box
from historical_atlas_name_union import compare_named_unions


def row(i, name, geometry):
    return dict(archiveIndex=i, archiveName=name, polygon=geometry)


def rev(i, name, geometry, entity='Q1'):
    return dict(id=i, name=name, geometryId=geometry, entityId=entity)


def check(name, old, revisions, geometries):
    output = compare_named_unions(old, revisions, geometries, lambda s: ' '.join(s.lower().split()))
    assert len(output) == 1, (name, output)
    print('PASS', name)
    return output[0]


whole = box(0, 0, 2, 1)
left, right = box(0, 0, 1, 1), box(1, 0, 2, 1)
r = check('two archived Russian Empire parts', [row(0,'Russian Empire',left),
          row(1,'RUSSIAN  EMPIRE',right)], [rev('r','Russian Empire','full')], {'full':whole})
assert r['iou'] == 1 and r['archiveIndices'] == [0,1]
r = check('two atlas political parts', [row(0,'UK',whole)],
          [rev('a','UK','left'),rev('b','UK','right')], {'left':left,'right':right})
assert r['iou'] == 1 and r['atlasPolygonCount'] == 2
r = check('genuine border disagreement', [row(0,'A',left)],
          [rev('r','A','big')], {'big':box(0,0,3,1)})
assert r['status'] == 'named-union-disagreement' and r['iou'] == .333333
r = check('duplicates do not double count', [row(0,'A',left),row(1,'A',left)],
          [rev('a','A','same'),rev('b','A','same')], {'same':left})
assert r['iou'] == 1 and r['atlasPolygonCount'] == 1
r = check('excluded archive part blocks acceptance', [row(0,'A',left),row(1,'A',None)],
          [rev('a','A','same')], {'same':left})
assert r['status'] == 'incomplete-archive-geometry' and r['excludedArchiveIndices'] == [1]
r = check('homonymous entities flagged', [row(0,'A',left)],
          [rev('a','A','same','Q1'),rev('b','A','also','Q2')], {'same':left,'also':left})
assert r['ambiguousAtlasIdentities']
assert compare_named_unions([row(0,'',left)], [rev('a','','same')], {'same':left}, lambda s:s)==[]
print('PASS empty names excluded')
