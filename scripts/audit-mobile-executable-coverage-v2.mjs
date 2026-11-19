#!/usr/bin/env node
/** Source-level coverage accounting, NOT runtime execution. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const inventory=JSON.parse(fs.readFileSync(new URL('../qa/mobile-executable-coverage-v2.json',import.meta.url),'utf8'));
const checks=inventory.checks;
assert.equal(inventory.acceptanceStatus,'BLOCKED');
assert.equal(new Set(checks.map(x=>x.id)).size,checks.length,'Duplicate executable check IDs');
assert.ok(checks.length>=16,'Unexpected loss of executable checks');
for(const check of checks){
 assert.ok(check.id&&check.driver&&check.oracle&&check.environment);
 assert.equal(check.status,'implemented-unverified','Do not claim pass without evidence');
 assert.equal(check.lastRun,null,'Run result cannot be fabricated');
 assert.ok(fs.existsSync(check.driver),'Missing driver '+check.driver);
 const source=fs.readFileSync(check.driver,'utf8');
 const key={
 'browser-layout':"tag+'-layout'",
 'browser-create-board':"tag+'-create-board-physical-touch'",
 'browser-pen-persistence':"const savedInk=",
 'browser-undo-redo':"const firstInk=",
 'browser-reload-persistence':"Reload the actual board frame",
 'browser-keyboard-blur':"tag+'-keyboard-outside-tap'",
 'browser-navigation-storm':"tag+'-touch-storm'",
 'native-startup-layout':"'installed-native-capacitor-and-layout'",
 'native-navigation-storm':"'native-touch-navigation-storm'",
 'native-keyboard-blur':"'native-keyboard-outside-touch'",
 'native-board-create':"'native-create-board'",
 'native-pen-persistence':"'native-touch-pen-persistence'",
 'native-orientation':"'native-rotation-roundtrip'",
 'native-pinch-zoom':"'native-two-finger-pinch'",
 'native-undo-redo':"'native-undo-redo'",
 'native-marker-eraser':"'native-marker-eraser'",
 }[check.id];
 assert.ok(key&&source.includes(key),'Declared check not found in driver: '+check.id);
}
console.log(JSON.stringify({staticAudit:'PASS',executableChecksDeclared:checks.length,executedChecks:0,acceptanceStatus:'BLOCKED',note:'Driver source presence is not a successful device run'},null,2));
