import assert from "node:assert/strict";
import {build} from "esbuild";

const bundle=await build({
 entryPoints:["src/lektrusOrganicNomenclature.ts"],bundle:true,platform:"node",
 format:"esm",write:false,logLevel:"silent"
});
const {nameOrganicStructure,parseOrganicReference,ORGANIC_REFERENCE_COUNT}=
 await import("data:text/javascript;base64,"+Buffer.from(bundle.outputFiles[0].text).toString("base64"));
assert.ok(ORGANIC_REFERENCE_COUNT>=75,"Substantial curated structure reference is required");

const item=(smiles)=>{
 const parsed=parseOrganicReference(smiles);
 return {graphPoints:parsed.atoms.map((label,i)=>({x:i,y:0,label})),
  graphSegments:parsed.links.map(e=>({a:e.a,b:e.b,bondOrder:e.order}))};
};
const shouldName=(smiles,systematic,trivial=null)=>{
 const result=nameOrganicStructure(item(smiles));
 assert.equal(result.systematic,systematic,smiles);
 assert.equal(result.trivial,trivial,smiles);
 return result;
};
shouldName("C","метан");
shouldName("CC","этан");
shouldName("CCCCC","пентан");
shouldName("CC(C)CCC","2-метилпентан");
shouldName("CC(Cl)CC","2-хлорбутан");
shouldName("CC=CC","бут-2-ен");
shouldName("C#CC","пропин","метилацетилен");
shouldName("C=CCO","проп-2-ен-1-ол");
shouldName("CCC(O)C(=O)O","2-гидроксибутановая кислота");
shouldName("NCCC(=O)O","3-аминопропановая кислота");
shouldName("CC(=O)CCO","4-гидроксибутан-2-он");
shouldName("CCCCC(=O)C","гексан-2-он");
shouldName("CC(C)C","2-метилпропан","изобутан");
shouldName("CC(C)(C)C","2,2-диметилпропан","неопентан");
shouldName("C(=O)O","метановая кислота","муравьиная кислота");
shouldName("CC(=O)O","этановая кислота","уксусная кислота");
shouldName("CC(O)C","пропан-2-ол","изопропиловый спирт");
shouldName("CC(=O)C","пропан-2-он","ацетон");
shouldName("C=O","метаналь","формальдегид");
shouldName("CC(=O)OCC","этилэтаноат","этилацетат");
shouldName("CC(=O)N","этанамид","ацетамид");
shouldName("OCC(O)CO","пропан-1,2,3-триол","глицерин");
shouldName("C1=CC=CC=C1","бензол");
shouldName("CC1=CC=CC=C1","метилбензол","толуол");
shouldName("C1=CC=CC=C1N","бензенамин","анилин");
shouldName("C1=CC=CC=C1O","фенол","карболовая кислота");
shouldName("C1CCCCC1","циклогексан");
shouldName("C(Cl)(Cl)Cl","трихлорметан","хлороформ");
shouldName("C(Cl)(Cl)(Cl)Cl","тетрахлорметан","четырёххлористый углерод");
// Atom order and drawing geometry have no effect on the chemical identity.
const acetate=item("CC(=O)OCC"),count=acetate.graphPoints.length;
const permutation=Array.from({length:count},(_,i)=>count-1-i);
const reordered={
 graphPoints:permutation.map(i=>({...acetate.graphPoints[i],x:Math.random()*4,y:Math.random()*4})),
 graphSegments:acetate.graphSegments.map(e=>({ ...e,
   a:permutation.indexOf(e.a),b:permutation.indexOf(e.b)})).reverse()
};
assert.equal(nameOrganicStructure(reordered).trivial,"этилацетат");
// Never confuse isomers just because the molecular formula is the same.
assert.notEqual(nameOrganicStructure(item("CCCO")).systematic,
 nameOrganicStructure(item("CC(O)C")).systematic);
// Fail closed: unrecognized ring systems, disconnected sketches and impossible valences.
assert.equal(nameOrganicStructure(item("C1CCCCCCCC1")).status,"unsupported");
const disjoint=item("CC");
disjoint.graphPoints.push({x:9,y:0,label:"C"});
assert.equal(nameOrganicStructure(disjoint).status,"unsupported");
assert.equal(nameOrganicStructure(item("C(Cl)(Cl)(Cl)(Cl)Cl")).status,"unsupported");
assert.equal(nameOrganicStructure(item("CCOCCC")).status,"unsupported");
console.log("Organic names: "+ORGANIC_REFERENCE_COUNT+
 " reference structures, priority, Russian terminology, isomers, unsupported cases: OK");
