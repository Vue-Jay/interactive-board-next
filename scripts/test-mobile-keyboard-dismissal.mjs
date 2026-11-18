import assert from 'node:assert/strict';
import {installMobileKeyboardDismissal} from '../src/dismissMobileKeyboard.ts';

// Independently exercise the event fallback (including cancelled pointer
// sequences on WebKit), without faking an OS keyboard or a browser test.
class ElementStub {
  constructor(kind){this.kind=kind;}
  closest(selector){
    if(this.kind==='field'&&selector.startsWith('textarea'))return this;
    if(this.kind==='label'&&selector==='label')return this;
    return null;
  }
  contains(target){return target===this;}
  blur(){if(doc.activeElement===this)doc.activeElement=outside;}
}
globalThis.Element=ElementStub;
const field=new ElementStub('field'),other=new ElementStub('field'),outside=new ElementStub('outside');
const label=new ElementStub('label');label.control=other;
const listeners=new Map();
const doc={activeElement:field,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
const queued=new Map();let timer=0;
const win={matchMedia:()=>({matches:true}),setTimeout:fn=>{queued.set(++timer,fn);return timer;},clearTimeout:id=>queued.delete(id)};
const stop=installMobileKeyboardDismissal(true,doc,win);
const emit=(name,target,extra={})=>listeners.get(name)?.({composedPath:()=>[target],...extra});
const touch=(name,target,x=20,y=20,remaining=name==='touchend'?[]:[{identifier:2,clientX:x,clientY:y}])=>emit(name,target,{touches:remaining,changedTouches:[{identifier:2,clientX:x,clientY:y}]});
const pointer=(name,target,x=20,y=20)=>emit(name,target,{isPrimary:true,button:0,pointerType:'touch',pointerId:2,clientX:x,clientY:y});
const finish=()=>{const callbacks=[...queued.values()];queued.clear();for(const fn of callbacks)fn();return doc.activeElement;};
const check=(name,fn,expected)=>{doc.activeElement=field;fn();assert.equal(finish(),expected,name);console.log('PASS '+name);};
check('pointer outside tap',()=>{pointer('pointerdown',outside);pointer('pointerup',outside)},outside);
check('touch without pointer events',()=>{touch('touchstart',outside);touch('touchend',outside)},outside);
check('cancelled pointer with completed tap',()=>{pointer('pointerdown',outside);touch('touchstart',outside);pointer('pointercancel',outside);touch('touchend',outside)},outside);
check('touch drag',()=>{touch('touchstart',outside);touch('touchmove',outside,20,60);touch('touchend',outside,20,60)},field);
check('touch cancellation',()=>{touch('touchstart',outside);touch('touchcancel',outside);touch('touchend',outside)},field);
check('two fingers',()=>{touch('touchstart',outside);touch('touchstart',outside,20,20,[{identifier:1},{identifier:2}]);touch('touchend',outside)},field);
check('other field label',()=>{touch('touchstart',label);touch('touchend',label)},field);
check('newly focused field',()=>{touch('touchstart',outside);touch('touchend',outside);doc.activeElement=other},other);
check('WebKit compatibility click on old field',()=>{touch('touchstart',outside);touch('touchend',outside);assert.equal(doc.activeElement,field);emit('click',field)},outside);
check('second deliberate touch cancels pending dismissal',()=>{touch('touchstart',outside);touch('touchend',outside);touch('touchstart',other);touch('touchend',other);doc.activeElement=other;emit('click',other)},other);
stop();assert.equal(listeners.size,0);
