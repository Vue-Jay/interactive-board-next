import assert from 'node:assert/strict';
import { minimapViewport, minimapExtent, minimapTarget, minimapContentBounds } from '../src/boardMinimap.ts';

const view = {x: -400, y: 120, zoom: 2};
const viewport = minimapViewport(view, {width: 1000, height: 400});
assert.deepEqual(viewport, {x: 200, y: -60, width: 500, height: 200});
const content = {x:-300,y:-900,width:100,height:1200};
const extent = minimapExtent(content,viewport);
for(const r of [content,viewport]) {
  assert.ok(extent.x<=r.x && extent.y<=r.y);
  assert.ok(extent.x+extent.width>=r.x+r.width && extent.y+extent.height>=r.y+r.height);
}
const world = {x:0,y:0,width:1000,height:500};
const visible = {x:0,y:0,width:250,height:100};
// A square map has vertical letterbox bands; the inverse uses the same scale.
assert.deepEqual(minimapTarget({x:100,y:100},{width:200,height:200},world,visible),{x:500,y:250});
assert.deepEqual(minimapTarget({x:100,y:60},{width:200,height:200},world,visible),{x:500,y:50});
assert.deepEqual(minimapTarget({x:500,y:500},{width:200,height:200},world,visible),{x:875,y:450});
const rotated=minimapContentBounds([{x:0,y:0,width:100,height:20,rotation:90}]);
assert.ok(Math.abs(rotated.x-40)<1e-8 && Math.abs(rotated.y+40)<1e-8 && Math.abs(rotated.width-20)<1e-8 && Math.abs(rotated.height-100)<1e-8);
assert.equal(minimapViewport(view,{width:0,height:400}),null);
console.log('Minimap: exact camera rectangle, union bounds, rotated content, letterbox hit testing and drag containment OK.');
