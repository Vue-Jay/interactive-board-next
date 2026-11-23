import assert from 'node:assert/strict';
import {installAuthViewport} from '../src/authViewport.ts';

class ElementStub { matches(){return true;} }
globalThis.Element=ElementStub;
const input=new ElementStub();
const doc={activeElement:null};
const attrs=new Set(), props=new Map(), handlers=new Map(), viewportHandlers=new Map(), shellHandlers=new Map();
let now=0;
const query={matches:false};
const shell={contains:e=>e===input,setAttribute:n=>attrs.add(n),removeAttribute:n=>attrs.delete(n),
  style:{setProperty:(n,v)=>props.set(n,v),removeProperty:n=>props.delete(n)},
  addEventListener:(n,f)=>shellHandlers.set(n,f),removeEventListener:n=>shellHandlers.delete(n)};
const viewport={height:1040,scale:1,addEventListener:(n,f)=>viewportHandlers.set(n,f),removeEventListener:n=>viewportHandlers.delete(n)};
const win={innerWidth:600,innerHeight:1040,visualViewport:viewport,matchMedia:()=>query,performance:{now:()=>now},
  addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:n=>handlers.delete(n)};
const resize=(w,h,v=h)=>{win.innerWidth=w;win.innerHeight=h;viewport.height=v;handlers.get('resize')();};
const check=(v,s)=>{assert.equal(props.get('--auth-visible-height'),`${v}px`);assert.equal(props.get('--auth-stable-height'),`${s}px`);};
const stop=installAuthViewport(shell,true,win,doc);
assert.ok(attrs.has('data-auth-mobile'),'Native mouse-pointer emulator must use mobile auth');check(1040,1040);
doc.activeElement=input;resize(600,620);check(620,1040);
resize(600,1040,510);check(510,1040); // keyboard only shrinks visual viewport
doc.activeElement=null;shellHandlers.get('focusout')({target:input});now=100;resize(600,800);check(800,1040);
resize(600,1040);check(1040,1040);
now=1000;resize(600,850);check(850,850); // genuine window resize, no editor
doc.activeElement=input;resize(850,600);check(600,600); // rotation/window width change
viewport.scale=2;resize(850,600,300);check(600,600); // browser accessibility zoom
stop();assert.equal(attrs.size,0);assert.equal(props.size,0);assert.equal(handlers.size+viewportHandlers.size+shellHandlers.size,0);
const stopWeb=installAuthViewport(shell,false,win,doc);assert.equal(attrs.size,0);query.matches=true;resize(390,844);assert.ok(attrs.has('data-auth-mobile'));check(844,844);stopWeb();
console.log('PASS auth viewport: native mouse emulator, IME layout/visual resize, blur, rotation, zoom, cleanup, responsive browser');
