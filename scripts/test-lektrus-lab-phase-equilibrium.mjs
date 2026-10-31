import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const src=readFileSync(new URL("../src/lektrusLabEvaporation.ts",import.meta.url),"utf8");
const exports={};
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS};
const material={};
const measurements={};
const measuredSource=readFileSync(new URL("../src/lektrusLabSolubilityMeasurements.ts",import.meta.url),"utf8");
new Function("exports",ts.transpileModule(measuredSource,{compilerOptions:options}).outputText)(measurements);
const materialSource=readFileSync(new URL("../src/lektrusLabMaterialConstants.ts",import.meta.url),"utf8");
new Function("require","exports",ts.transpileModule(materialSource,{compilerOptions:options}).outputText)(
 key=>{assert.equal(key,"./lektrusLabSolubilityMeasurements");return measurements;},material);
const js=ts.transpileModule(src,{compilerOptions:options}).outputText;
new Function("require","exports",js)(key=>{
 assert.equal(key,"./lektrusLabMaterialConstants");return material;
},exports);
const {labSaturationPressureKPa,labVaporPressureKPa,labIdealBoilingC,
 labApproxWaterBoilingC,labEvaporate}=exports;
const ml=value=>({value,unit:"ml"});
const g=value=>({value,unit:"g"});
const water={kind:"beaker",doses:{H2O:ml(20)}};
const salt={kind:"beaker",doses:{H2O:ml(20),NaCl:g(1)}};
const lessSalt={kind:"beaker",doses:{H2O:ml(20),NaCl:g(.25)}};
const alcohol={kind:"beaker",doses:{C2H5OH:ml(20)}};
const mix={kind:"beaker",doses:{H2O:ml(20),C2H5OH:ml(20)}};
const unknown={kind:"beaker",doses:{HCl:{value:20,unit:"ml",concentrationM:.1}}};
assert.ok(labSaturationPressureKPa("H2O",22)>2.5);
assert.ok(labSaturationPressureKPa("H2O",22)<3);
assert.ok(labVaporPressureKPa(salt,22)<labVaporPressureKPa(lessSalt,22));
assert.ok(labVaporPressureKPa(lessSalt,22)<labVaporPressureKPa(water,22),
 "Nonvolatile dissolved particles lower water vapor pressure");
assert.ok(labVaporPressureKPa(salt,70)>labVaporPressureKPa(salt,22),
 "Heating raises the mixture vapor pressure");
assert.equal(labVaporPressureKPa(unknown,22),undefined,
 "Unknown prepared stock solvent cannot be assigned a made-up vapor pressure");
assert.equal(labIdealBoilingC(unknown),undefined);
assert.equal(labIdealBoilingC({kind:"tube",doses:{H2O:ml(20),CuSO4:g(1)}}),undefined,
 "Unknown nonideal dissolved species must not become a pure-water boiling point");
assert.ok(Math.abs(labIdealBoilingC(water)-100)<.3);
assert.ok(Math.abs(labIdealBoilingC(alcohol)-78.37)<1);
assert.ok(labIdealBoilingC(mix)>labIdealBoilingC(alcohol));
assert.ok(labIdealBoilingC(mix)<labIdealBoilingC(water));
assert.ok(labIdealBoilingC(salt)>labIdealBoilingC(water));
assert.ok(labIdealBoilingC(salt)>labIdealBoilingC(lessSalt));
assert.equal(labApproxWaterBoilingC({H2O:ml(20),NaCl:g(6)}),undefined,
 "Concentrated electrolyte is beyond the ideal dilute-solution model");
const one=labEvaporate(salt,10,50,50);
assert.ok(one.evaporatedMl>0);
assert.equal(one.doses.NaCl.value,1,"The nonvolatile solute stays when water evaporates");
assert.ok(one.doses.H2O.value<20);
assert.ok(Math.abs(one.doses.H2O.value+(one.ventedVaporMl.H2O??0)-20)<1e-6,
 "Evaporated water must be recorded, not lost from the mass ledger");
const two=labEvaporate({...salt,doses:one.doses,ventedVaporMl:one.ventedVaporMl},10,50,50);
assert.ok(Math.abs(two.doses.H2O.value+(two.ventedVaporMl.H2O??0)-20)<1e-5,
 "Multiple time steps conserve original solvent volume");
const warm=labEvaporate(alcohol,10,40,40);
const cool=labEvaporate(alcohol,10,25,25);
assert.ok(warm.evaporatedMl>cool.evaporatedMl);
assert.equal(labEvaporate({...salt,stoppered:true},10,22,22).evaporatedMl,0);
assert.equal(labEvaporate({...salt,stoppered:true},10,22,22).stoppered,true);
const popped=labEvaporate({...alcohol,stoppered:true},10,90,130);
assert.equal(popped.popped,true);
assert.ok(popped.pressureKPa>160);
assert.equal(labEvaporate(unknown,10,50,50).evaporatedMl,0);
for(let i=0;i<3;i++){
 const extreme={kind:"dish",doses:{H2O:ml(.00001)}};
 const after=labEvaporate(extreme,10,100,200);
 assert.ok(after.evaporatedMl>=0&&after.evaporatedMl<=.00001);
}
const markup=readFileSync(new URL("../src/LektrusChemistryBench.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../src/lektrusLabSceneLayout.css",import.meta.url),"utf8");
assert.match(markup,/lektrus-lab-reagent-row/);
assert.match(markup,/quickReagents\.slice\(row\*4,\(row\+1\)\*4\)/);
assert.match(css,/\.lektrus-lab-reagent-row::after\{/);
assert.match(css,/background:none!important;background-image:none!important/,
 "No whole-rack repeating shelf gradients allowed through dose labels");
assert.match(css,/\.lektrus-lab-reagent-row\{[^}]*padding:0 2px 9px/s,
 "The bottle and captions reserve physical space above each separate shelf rail");
console.log("Ideal vapor/boiling equilibrium, salt activity, 2-step mass conservation, stoppers and physical shelf spacing: OK");


const gasLid={
 kind:"conical",stoppered:true,stopperedAtC:25,
 doses:{H2O:ml(20)},headspaceMl:90,reactionGasMol:.001
};
const noGasLid={...gasLid,reactionGasMol:0};
const humid=labEvaporate(gasLid,0,25);
const blank=labEvaporate(noGasLid,0,25);
assert.ok(humid.pressureKPa>blank.pressureKPa);
const expectedGasKPa=.001*8.314462618*(25+273.15)/.09;
assert.ok(Math.abs((humid.pressureKPa-blank.pressureKPa)-expectedGasKPa)<1e-8,
 "Trapped CO2 obeys PV=nRT using the actual measured gas headspace");
const halfHeadspace=labEvaporate({...gasLid,headspaceMl:45},0,25);
assert.ok(Math.abs((halfHeadspace.pressureKPa-blank.pressureKPa)-2*expectedGasKPa)<1e-7,
 "Halving gas volume doubles the excess ideal-gas pressure");
const freshlySealed=labEvaporate({
 kind:"conical",stoppered:true,stopperedAtC:50,
 doses:{C2H5OH:ml(10)},headspaceMl:100
},0,50);
assert.ok(Math.abs(freshlySealed.pressureKPa-101.325)<1e-6,
 "Newly sealing hot glassware does not fabricate pressure rise");
assert.ok(labEvaporate({...gasLid,reactionGasMol:.004},10,30).popped,
 "Sufficient measured product gas pops a non-pressure-rated cork");
const modelSource=readFileSync(new URL("../src/lektrusChemistryBenchModel.ts",import.meta.url),"utf8");
const validatorSource=readFileSync(new URL("../src/boardModel.ts",import.meta.url),"utf8");
assert.match(modelSource,/export function labVesselPressure/);
assert.match(modelSource,/retainedGasMol/);
assert.match(validatorSource,/v\.stopperedAtC/);
console.log("Closed flask gas-headspace PV=nRT, seal temperatures, stopper release and schema: OK");


const aqueousAcidWithGas={
 kind:"conical",stoppered:true,stopperedAtC:22,headspaceMl:100,
 doses:{HCl:{value:10,unit:"ml",concentrationM:.1}},
 reactionGasMol:.002,temperatureC:22
};
const acidGasReading=labEvaporate(aqueousAcidWithGas,0,22);
const acidGasPressure=.002*8.314462618*(22+273.15)/.1;
assert.ok(Math.abs(acidGasReading.reactionGasPressureKPa-acidGasPressure)<1e-8,
 "Measured gas partial pressure is always quantified, even for aqueous stocks");
assert.equal(acidGasReading.pressureKPa,undefined,
 "An unverified solvent vapor model must not invent a total headspace pressure");
const forceRelease=labEvaporate({...aqueousAcidWithGas,reactionGasMol:.01},10,22);
assert.ok(forceRelease.popped&&!forceRelease.stoppered,
 "When gas partial pressure alone exceeds cork limit, safely pop the cork");
