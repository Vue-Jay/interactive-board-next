#!/usr/bin/env python3
"""Independent installed-app mobile stress runner (Appium WebView).
Requires a running Appium server and an installed debug APK/iOS simulator app.
No production writes. Physical WebDriver taps, not DOM .click().
"""
import argparse, json, time, urllib.request, urllib.error, sys
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
def request(method,route,payload=None):
 data=None if payload is None else json.dumps(payload).encode()
 req=urllib.request.Request(BASE+route,data=data,method=method,headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=120) as response:
  raw=json.load(response)
  if 'value' not in raw:raise RuntimeError(str(raw))
  return raw['value']
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
def check(name,fn):
 started=time.monotonic()
 try:
  detail=fn();results.append({'name':name,'status':'passed','detail':detail,'seconds':round(time.monotonic()-started,2)})
  print('PASS',name,flush=True)
 except Exception as error:
  results.append({'name':name,'status':'failed','error':str(error),'seconds':round(time.monotonic()-started,2)})
  print('FAIL',name,error,flush=True)
def attach():
 for name in cmd('GET','/contexts'):
  if not name.startswith('WEBVIEW'):continue
  cmd('POST','/context',{'name':name})
  if js('return !!document.documentElement && window.Capacitor?.isNativePlatform?.()===true'):return name
 raise AssertionError('Installed native Capacitor WebView not found')
def visible_controls():
 return js("""return [...document.querySelectorAll('button')].filter(e=>{
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);
  return r.width>=24&&r.height>=24&&s.visibility!=='hidden'&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;
 }).map(e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,50)}});""")
def tap(x,y):
 # WebDriver W3C pointer touch action. Never fake DOM pointer events.
 cmd('POST','/actions',{'actions':[{'type':'pointer','id':'finger1','parameters':{'pointerType':'touch'},'actions':[{'type':'pointerMove','duration':0,'x':x,'y':y},{'type':'pointerDown','button':0},{'type':'pause','duration':60},{'type':'pointerUp','button':0}]}]})
 cmd('DELETE','/actions')
def layout():
 return js("""return {w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth,
  native:window.Capacitor?.isNativePlatform?.()===true,
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
 for name,value in [('LANDSCAPE',1),('PORTRAIT',0)]:
  cmd('POST','/orientation',{'orientation':name})
  wait(lambda:bool(js('return innerWidth>innerHeight'))==bool(value),'Orientation did not settle: '+name,30)
  state=layout()
  assert state['scroll']<=state['w']+3,state
 return {'orientations':['LANDSCAPE','PORTRAIT']}
try:
 capabilities=({'platformName':'Android','appium:automationName':'UiAutomator2','appium:app':args.app,'appium:autoGrantPermissions':True} if args.platform=='android' else {'platformName':'iOS','appium:automationName':'XCUITest','appium:app':args.app,'appium:udid':args.udid})
 value=request('POST','/session',{'capabilities':{'alwaysMatch':capabilities,'firstMatch':[{}]}})
 # W3C returns sessionId outside value on some older drivers.
 session=value.get('sessionId')
 if not session:raise RuntimeError('Appium did not return session ID')
 wait(lambda:attach(),'Native WebView never became ready',90)
 check('installed-native-capacitor-and-layout',home_layout)
 check('native-touch-navigation-storm',navigation_storm)
 check('native-rotation-roundtrip',orientation)
finally:
 args.output.mkdir(parents=True,exist_ok=True)
 (args.output/(args.platform+'-stress-results.json')).write_text(json.dumps({'platform':args.platform,'installedApp':True,'results':results},indent=2)+'\n')
 if session:
  try:cmd('DELETE','')
  except Exception:pass
print(json.dumps({'total':len(results),'failed':sum(r['status']!='passed' for r in results)}))
if not results or any(r['status']!='passed' for r in results):sys.exit(1)
