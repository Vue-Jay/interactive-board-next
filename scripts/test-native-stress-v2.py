#!/usr/bin/env python3
"""Independent installed-app mobile stress runner (Appium WebView).
Requires a running Appium server and an installed debug APK/iOS simulator app.
No production writes. Physical WebDriver taps, not DOM .click().
"""
import argparse, json, time, urllib.request, urllib.error, sys, traceback, base64
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('platform',choices=['android','ios'])
p.add_argument('--app',required=True)
p.add_argument('--udid')
p.add_argument('--iterations',type=int,default=100)
p.add_argument('--output',type=Path,default=Path('artifacts/native-stress-v2'))
args=p.parse_args()
if not 1<=args.iterations<=10000:p.error('iterations must be between 1 and 10000')
if args.platform=='ios' and not args.udid:p.error('--udid required for iOS')
BASE='http://127.0.0.1:4723'; session=None; results=[]
def request(method,route,payload=None,full=False):
 data=None if payload is None else json.dumps(payload).encode()
 req=urllib.request.Request(BASE+route,data=data,method=method,headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=120) as response:
  raw=json.load(response)
  if 'value' not in raw:raise RuntimeError(str(raw))
  return raw if full else raw['value']
def cmd(method,route,payload=None):return request(method,'/session/'+session+route,payload)
def js(source,*arguments):return cmd('POST','/execute/sync',{'script':source,'args':list(arguments)})
def wait(fn,reason,seconds=60):
 deadline=time.monotonic()+seconds
 while time.monotonic()<deadline:
  try:
   value=fn()
   if value:return value
  except Exception:pass
  time.sleep(.35)
 raise AssertionError(reason)
def capture(name):
 if not session:return {'status':'unavailable','reason':'no session'}
 try:
  raw=base64.b64decode(cmd('GET','/screenshot'),validate=True)
  if not raw.startswith(b'\\x89PNG\\r\\n\\x1a\\n'):raise ValueError('Not a PNG')
  args.output.mkdir(parents=True,exist_ok=True)
  target=args.output/(args.platform+'-'+name+'.png')
  target.write_bytes(raw)
  return {'status':'captured','path':str(target)}
 except Exception as error:return {'status':'missing','error':str(error)}
def check(name,fn,requires=None):
 started=time.monotonic()
 if requires and any(not any(x['name']==dep and x['status']=='passed' for x in results) for dep in requires):
  results.append({'name':name,'status':'blocked','reason':'Prerequisite failed','requires':requires})
  print('BLOCKED',name,flush=True)
  return
 try:
  detail=fn()
  evidence=capture(name)
  status='passed' if evidence['status']=='captured' else 'blocked'
  results.append({'name':name,'status':status,'detail':detail,'seconds':round(time.monotonic()-started,2),'screenshot':evidence})
  print(status.upper(),name,flush=True)
 except Exception as error:
  results.append({'name':name,'status':'failed','error':str(error),'seconds':round(time.monotonic()-started,2),'screenshot':capture(name+'-failure')})
  print('FAIL',name,error,flush=True)
def attach():
 errors=[]
 for name in cmd('GET','/contexts'):
  if not name.startswith('WEBVIEW'):continue
  try:
   cmd('POST','/context',{'name':name})
   if js('return !!document.documentElement && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()===true'):return name
  except Exception as error:errors.append(str(error))
 raise AssertionError('Installed native Capacitor WebView not found: '+str(errors[-3:]))
def visible_controls():
 return js("""return [...document.querySelectorAll('button')].filter(e=>{
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);
  return r.width>=24&&r.height>=24&&s.visibility!=='hidden'&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;
 }).map(e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),label:e.getAttribute('aria-label')||(e.textContent||'').trim().slice(0,50)}});""")
def tap(x,y):
 # WebDriver W3C pointer touch action. Never fake DOM pointer events.
 cmd('POST','/actions',{'actions':[{'type':'pointer','id':'finger1','parameters':{'pointerType':'touch'},'actions':[{'type':'pointerMove','duration':0,'x':x,'y':y},{'type':'pointerDown','button':0},{'type':'pause','duration':60},{'type':'pointerUp','button':0}]}]})
 cmd('DELETE','/actions')
ELEMENT='element-6066-11e4-a52e-4f735466cecf'
def element(selector):
 return js("""return [...document.querySelectorAll(arguments[0])].find(e=>{
  const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';
 })||null;""",selector)
def tap_selector(selector):
 el=wait(lambda:element(selector),'Missing visible touch target: '+selector)
 # W3C WebElement click dispatches through the installed WebView driver.
 cmd('POST','/element/'+el[ELEMENT]+'/click',{})
 return el
def keyboard_outside_touch():
 tap_selector('.lectris-mobile-bottom button[aria-label="Ещё разделы"]')
 wait(lambda:element('.lektrus-more-page-search input'),'Search input missing')
 el=tap_selector('.lektrus-more-page-search input')
 cmd('POST','/element/'+el[ELEMENT]+'/value',{'text':'Настройки','value':list('Настройки')})
 assert js('return document.querySelector(".lektrus-more-page-search input").value')=='Настройки'
 tap_selector('.lektrus-more-page-title h1')
 wait(lambda:js('return document.activeElement!==document.querySelector(".lektrus-more-page-search input")'),'Outside touch did not blur search')
 assert js('return document.querySelector(".lektrus-more-page-search input").value')=='Настройки'
 return {'outsideTapBlurred':True,'valuePreserved':True}
def create_board():
 # Navigate from a clean workspace after prior keyboard test.
 tap_selector('.lectris-mobile-bottom button[aria-label="Доски"]')
 wait(lambda:element('.lectris-library-new'),'Board library missing')
 tap_selector('.lectris-library-new')
 field=wait(lambda:element('.lektrus-create-dialog input'),'Create-board title missing')
 cmd('POST','/element/'+field[ELEMENT]+'/click',{})
 title='Native stress '+args.platform+' '+str(int(time.time()))
 cmd('POST','/element/'+field[ELEMENT]+'/value',{'text':title,'value':list(title)})
 assert js('return document.querySelector(".lektrus-create-dialog input").value')==title
 tap_selector('.lektrus-create-dialog button[type="submit"]')
 wait(lambda:element('section.board'),'Native board did not render after submission',90)
 actual=js('return (document.querySelector(".board-title")||{}).value')
 assert actual==title,{'expected':title,'actual':actual}
 return {'title':actual,'createdVia':'installed app'}
def native_ink_stroke():
 tap_selector('nav.mobile-board-tools button[data-interface-control="pen"],.toolbar-pinned button[data-interface-control="pen"]')
 wait(lambda:js('return !!(document.querySelector("section.board")&&document.querySelector("section.board").classList.contains("board-tool-pen"))'),'Pen did not activate')
 points=js("""const b=document.querySelector('section.board').getBoundingClientRect();
 return Array.from({length:12},(_,i)=>({x:Math.round(b.left+b.width*.35+i*5),y:Math.round(b.top+b.height*.55)}));""")
 assert points and all(0<=p['x']<=layout()['w'] and 0<=p['y']<=layout()['h'] for p in points),'Ink stroke outside native viewport'
 actions=[{'type':'pointerMove','duration':0,**points[0]},{'type':'pointerDown','button':0}]
 actions.extend({'type':'pointerMove','duration':40,**point} for point in points[1:])
 actions.append({'type':'pointerUp','button':0})
 cmd('POST','/actions',{'actions':[{'type':'pointer','id':'pen-finger','parameters':{'pointerType':'touch'},'actions':actions}]})
 cmd('DELETE','/actions')
 def persisted():
  return js("""for(const key of Object.keys(localStorage)){
   if(!key.includes('document'))continue;
   try{const data=JSON.parse(localStorage.getItem(key));const ink=(data&&data.items||[]).find(i=>i.kind==='pen'&&i.points&&i.points.length>1);if(ink)return {key,points:ink.points.length};}catch{}
  }return null;""")
 return wait(persisted,'Native touch stroke not persisted',20)
def native_undo_redo():
 def ink_state():
  return js("""for(const key of Object.keys(localStorage)){
   if(!key.includes('document'))continue;
   try{const data=JSON.parse(localStorage.getItem(key));if(Array.isArray(data&&data.items))
    return data.items.filter(i=>i.kind==='pen').map(i=>({id:i.id,points:(i.points&&i.points.length)||0}));}catch{}
  }return null;""")
 before=wait(ink_state,'Board ink storage missing')
 assert any(i['points']>1 for i in before),'No completed pen stroke before undo'
 tap_selector('button[aria-label="Отменить"]')
 wait(lambda:ink_state()!=before,'Undo did not change saved ink')
 undone=ink_state()
 tap_selector('button[aria-label="Повторить"]')
 wait(lambda:ink_state()==before,'Redo did not restore saved ink')
 return {'before':before,'undone':undone,'redone':ink_state()}
def native_pinch_zoom():
 tap_selector('nav.mobile-board-tools button[data-interface-control="select"],.toolbar-pinned button[data-interface-control="select"]')
 before=js('return (document.querySelector(".zoom-value")||{}).textContent')
 assert before,'Zoom indicator missing'
 center=js("""const b=document.querySelector('section.board').getBoundingClientRect();
 return {x:Math.round(b.left+b.width*.5),y:Math.round(b.top+b.height*.5)};""")
 def finger(id,sign):
  points=[{'type':'pointerMove','duration':0,'x':center['x']+sign*16,'y':center['y']},{'type':'pointerDown','button':0}]
  points.extend({'type':'pointerMove','duration':55,'x':center['x']+sign*(16+step*5),'y':center['y']} for step in range(1,10))
  points.append({'type':'pointerUp','button':0})
  return {'type':'pointer','id':id,'parameters':{'pointerType':'touch'},'actions':points}
 cmd('POST','/actions',{'actions':[finger('left-finger',-1),finger('right-finger',1)]})
 cmd('DELETE','/actions')
 wait(lambda:js('return (document.querySelector(".zoom-value")||{}).textContent')!=before,'Two-finger native pinch did not zoom',15)
 return {'zoomBefore':before,'zoomAfter':js('return (document.querySelector(".zoom-value")||{}).textContent')}
def layout():
 return js("""return {w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth,
  native:!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()),
  visible:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length).length};""")
def home_layout():
 wait(lambda:js('return !!document.querySelector(".lektrus-calendar-grid")'),'Workspace not ready')
 info=layout()
 assert info['native'],'Not running installed native app'
 assert info['scroll']<=info['w']+3,info
 assert info['visible']>0,info
 return info
def navigation_storm():
 controls=visible_controls()
 candidates=[c for c in controls if c['label'] in ('Доски','Главная','Главная страница')]
 assert candidates,'No known safe navigation control; refusing destructive random taps'
 c=candidates[0]
 for i in range(args.iterations):
  tap(c['x'],c['y'])
  if i%10==0:
   assert js('return !!document.documentElement'),'WebView disappeared'
  # Re-evaluate the target location after navigation/rotation.
  fresh=[x for x in visible_controls() if x['label']==c['label']]
  if not fresh:raise AssertionError('Navigation control disappeared after touch '+str(i))
  c=fresh[0]
 return {'touches':args.iterations,'target':c['label']}
def orientation():
 observed=[]
 for name,value in [('LANDSCAPE',1),('PORTRAIT',0)]:
  cmd('POST','/orientation',{'orientation':name})
  # Native WebView may be destroyed/recreated on rotation.
  wait(lambda:attach(),'WebView unavailable after '+name,45)
  wait(lambda:bool(js('return innerWidth>innerHeight'))==bool(value),'Orientation did not settle: '+name,30)
  state=layout()
  assert state['scroll']<=state['w']+3,state
  observed.append({'orientation':name,'viewport':state})
 return {'observed':observed}
fatal_error=None
try:
 capabilities=({'platformName':'Android','appium:automationName':'UiAutomator2','appium:app':args.app,'appium:autoGrantPermissions':True} if args.platform=='android' else {'platformName':'iOS','appium:automationName':'XCUITest','appium:app':args.app,'appium:udid':args.udid})
 response=request('POST','/session',{'capabilities':{'alwaysMatch':capabilities,'firstMatch':[{}]}},full=True)
 session=response.get('sessionId') or (response.get('value') or {}).get('sessionId')
 if not session:raise RuntimeError('Appium did not return session ID')
 wait(lambda:attach(),'Native WebView never became ready',90)
 check('installed-native-capacitor-and-layout',home_layout)
 check('native-touch-navigation-storm',navigation_storm,requires=['installed-native-capacitor-and-layout'])
 check('native-rotation-roundtrip',orientation,requires=['installed-native-capacitor-and-layout'])
 check('native-keyboard-outside-touch',keyboard_outside_touch,requires=['installed-native-capacitor-and-layout'])
 check('native-create-board',create_board,requires=['native-keyboard-outside-touch'])
 check('native-touch-pen-persistence',native_ink_stroke,requires=['native-create-board'])
 check('native-undo-redo',native_undo_redo,requires=['native-touch-pen-persistence'])
 check('native-two-finger-pinch',native_pinch_zoom,requires=['native-create-board'])
except Exception as error:
 fatal_error={'type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc()}
 print('FATAL',str(error),flush=True)
finally:
 args.output.mkdir(parents=True,exist_ok=True)
 (args.output/(args.platform+'-stress-results.json')).write_text(json.dumps({'platform':args.platform,'installedApp':True,'results':results,'fatalError':fatal_error},indent=2)+'\n')
 if session:
  try:cmd('DELETE','')
  except Exception:pass
print(json.dumps({'total':len(results),'failed':sum(r['status']!='passed' for r in results)}))
if fatal_error or not results or any(r['status']!='passed' for r in results):sys.exit(1)
