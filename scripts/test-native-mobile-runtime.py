"""Offline native Appium acceptance; the installed debug app is the test target.

No browser emulation, production account, or synthetic DOM pointer events.
DOM reads select/measure controls; all clicks and gestures go through WebDriver.
"""
import argparse
import base64
import json
import subprocess
import sys
import time
import traceback
import urllib.error
import urllib.request
from pathlib import Path


parser = argparse.ArgumentParser()
parser.add_argument('platform', choices=['android', 'ios'])
parser.add_argument('--app', required=True)
parser.add_argument('--udid')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
URL = 'http://127.0.0.1:4723'
session = None
web_context = None
results = []
ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'


def request(method, route, payload=None, timeout=180):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(URL + route, data=data, method=method,
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.load(response)['value']
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'{method} {route}: {error.read().decode()[:3500]}') from error


def command(method, route, payload=None):
    return request(method, f'/session/{session}{route}', payload)


def wait(fn, description, seconds=40):
    end = time.monotonic() + seconds
    last = None
    while time.monotonic() < end:
        try:
            value = fn()
            if value:
                return value
        except Exception as error:
            last = str(error)
        time.sleep(0.6)
    raise AssertionError(f'{description}; last error: {last}')


def context(name):
    command('POST', '/context', {'name': name})


def js(source, *arguments):
    return command('POST', '/execute/sync', {'script': source, 'args': arguments})


def visible_id(selector):
    # Find the visible variant, not the desktop copy hidden by media queries.
    element = js('return [...document.querySelectorAll(arguments[0])].find(e => '
                 'e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && '
                 'e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0) || null;', selector)
    return element and element[ELEMENT]


def click(selector):
    element = wait(lambda: visible_id(selector), f'Visible control: {selector}')
    command('POST', f'/element/{element}/click', {})
    return element


def screenshot(label):
    context('NATIVE_APP')
    try:
        encoded = command('GET', '/screenshot')
        (args.output / f'{label}.png').write_bytes(base64.b64decode(encoded))
    finally:
        context(web_context)


def check(name, fn, fatal=False):
    try:
        detail = fn()
        screenshot(f'{len(results)+1:02d}-{name}')
        results.append({'check': name, 'status': 'passed', 'detail': detail})
        print(f'PASS: {name}: {detail}', flush=True)
    except Exception as error:
        results.append({'check': name, 'status': 'failed', 'detail': str(error)})
        print(f'FAIL: {name}: {error}', flush=True)
        try:
            screenshot(f'{len(results):02d}-{name}-failure')
        except Exception:
            pass
        if fatal:
            raise


def layout(selectors):
    return js('''const vw=innerWidth,vh=innerHeight, out=[];
      for(const selector of arguments[0]){
        const elements=[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=="hidden");
        if(!elements.length){out.push({selector,missing:true});continue;}
        for(const e of elements){const r=e.getBoundingClientRect();if(r.width<1||r.height<1)continue;
          if(r.left < -2 || r.right > vw+2 || r.top < -2 || r.bottom > vh+2)
            out.push({selector,text:e.innerText||e.getAttribute('aria-label'),rect:[r.left,r.top,r.right,r.bottom]});
        }
      }
      return {width:vw,height:vh,scrollWidth:document.documentElement.scrollWidth,issues:out};''', selectors)


def check_layout(selectors):
    report = layout(selectors)
    assert report['scrollWidth'] <= report['width'] + 2, report
    assert not report['issues'], report
    return report


def home():
    wait(lambda: visible_id('.lektrus-calendar-grid'), 'Workspace not rendered', 90)
    return check_layout(['.lectris-mobile-bottom', '.lectris-mobile-bottom button'])


def more():
    click('.lectris-mobile-bottom button[aria-label="Ещё разделы"]')
    wait(lambda: visible_id('.lektrus-more-page'), 'More page not rendered')
    click('.lektrus-more-page-search input')
    # Actual native input/keyboard path; query must filter the list.
    element = visible_id('.lektrus-more-page-search input')
    command('POST', f'/element/{element}/value', {'text': 'Настройки', 'value': list('Настройки')})
    wait(lambda: js('return [...document.querySelectorAll(".lektrus-more-page-item")].some(e=>e.innerText.includes("Настройки"));'), 'Settings filter unavailable')
    return {'items': js('return [...document.querySelectorAll(".lektrus-more-page-item")].map(e=>e.innerText)')}


def workspace_section(label, route, selector):
    primary = f'.lectris-mobile-bottom button[aria-label="{label}"]'
    if visible_id(primary):
        click(primary)
    else:
        click('.lectris-mobile-bottom button[aria-label="Ещё разделы"]')
        element = wait(lambda: js('return [...document.querySelectorAll(".lektrus-more-page-item")].find(e=>e.querySelector(".lektrus-more-page-label")?.textContent===arguments[0])||null', label), f'Missing section: {label}')
        command('POST', f'/element/{element[ELEMENT]}/click', {})
    wait(lambda: visible_id(selector), f'Section did not render: {label}')
    assert js('return new URLSearchParams(location.search).get("section")') == route, f'Wrong page: {label}'
    return check_layout(['.lectris-mobile-bottom', '.lectris-mobile-bottom button'])


def open_new_board():
    click('.lectris-mobile-bottom button[aria-label="Доски"]')
    click('.lectris-library-new')
    title = click('.lektrus-create-dialog input[placeholder]')
    command('POST', f'/element/{title}/value', {'text': 'Native QA', 'value': list('Native QA')})
    wait(lambda: js('return document.querySelector(".lektrus-create-dialog input")?.value === "Native QA"'), 'Native keyboard did not enter title')
    screenshot('board-create-keyboard')
    click('.lektrus-create-dialog button[type="submit"]')
    wait(lambda: visible_id('section.board'), 'Board not rendered', 90)
    wait(lambda: js('return innerWidth>innerHeight'), 'Board failed to rotate to landscape', 30)
    assert js('return document.querySelector(".board-title")?.value') == 'Native QA', 'Board title did not persist'
    return {'viewport': js('return [innerWidth, innerHeight]'), 'path': js('return location.pathname')}


def board_layout():
    return check_layout(['.topbar', '.back-to-boards', '.board-title', '.board-controls'])


def choose_tool(tool):
    # The mobile dock has only pinned tools. Its creation cluster also scrolls
    # on short landscape displays; use the full mobile catalogue for marker
    # and eraser instead of mistaking hidden desktop controls for failures.
    if tool in ('marker', 'eraser') and visible_id('.mobile-tools-more'):
        click('.mobile-tools-more')
        label = {'marker':'Маркер','eraser':'Ластик'}[tool]
        click(f'.mobile-tools-sheet button[aria-label^="{label}"]')
    else:
        click(f'[data-interface-control="{tool}"]')
    wait(lambda: js('return document.querySelector("section.board")?.classList.contains("board-tool-"+arguments[0]);', tool), f'Tool not active: {tool}')


def ink():
    return js('''const keys=Object.keys(localStorage).filter(k=>k.includes(".local-test.board."));
      const id=location.pathname.split('/').pop();
      for(const key of keys.filter(k=>k.endsWith(id))){
        const d=JSON.parse(localStorage.getItem(key));
        if(Array.isArray(d?.items))return d.items.filter(i=>["pen","marker"].includes(i.kind)).map(i=>({id:i.id,kind:i.kind,points:i.points?.length||0}));
      }return [];''')


def path_for_ink(y_band):
    value = js('''const b=document.querySelector('section.board').getBoundingClientRect();
      const blockers='.board-object,button,input,select,textarea,[data-board-interactive],.toolbar,.board-controls,.mobile-board-tools,.selection-toolbar-screen,.topbar';
      for(const fy of arguments[0])for(const fx of [.38,.47,.55,.25,.65]){
        const pts=Array.from({length:9},(_,i)=>[Math.round(b.left+b.width*fx+9*i),Math.round(b.top+b.height*fy+Math.sin(i/3)*8)]);
        if(pts.every(([x,y])=>{const e=document.elementFromPoint(x,y);return e?.closest('section.board')&&!e.closest(blockers)}))return pts;
      }return null;''', y_band)
    assert value, 'No unblocked drawing path in the device viewport'
    return value


def native_gesture(points, second=None):
    viewport = js('return [innerWidth,innerHeight]')
    context('NATIVE_APP')
    try:
        classname = 'android.webkit.WebView' if args.platform == 'android' else 'XCUIElementTypeWebView'
        element = command('POST', '/element', {'using': 'class name', 'value': classname})[ELEMENT]
        rect = command('GET', f'/element/{element}/rect')
        sx, sy = rect['width']/viewport[0], rect['height']/viewport[1]
        # Physical pixels for Android, coordinate points for iOS. The native
        # WebView rect includes the actual OS bars/insets, not browser guesses.
        assert 0.5 <= sx <= 5 and 0.5 <= sy <= 5, (rect, viewport)
        def finger(pts, name):
            coords = [(round(rect['x']+x*sx), round(rect['y']+y*sy)) for x, y in pts]
            actions = [{'type':'pointerMove','duration':0,'x':coords[0][0],'y':coords[0][1],'origin':'viewport'},
                       {'type':'pointerDown','button':0}, {'type':'pause','duration':80}]
            actions.extend({'type':'pointerMove','duration':80,'x':x,'y':y,'origin':'viewport'} for x,y in coords[1:])
            actions.append({'type':'pointerUp','button':0})
            return {'type':'pointer','id':name,'parameters':{'pointerType':'touch'},'actions':actions}
        actions=[finger(points,'finger1')]
        if second:
            actions.append(finger(second,'finger2'))
        command('POST', '/actions', {'actions':actions})
        command('DELETE', '/actions')
    finally:
        context(web_context)


paths = {}


def pinch():
    choose_tool('select')
    width,height = js('return [innerWidth,innerHeight]')
    x,y=round(width*.52),round(height*.5)
    p1=[(x-18-i*5,y) for i in range(9)]
    p2=[(x+18+i*5,y) for i in range(9)]
    # The percentage is deliberately hidden in compact landscape. Read its
    # model-backed text, while the actual gesture goes through native touch.
    before=js('return document.querySelector(".zoom-value")?.textContent')
    assert before, 'Scale readout missing from board DOM'
    native_gesture(p1,p2)
    after=wait(lambda: js('return document.querySelector(".zoom-value")?.textContent') if js('return document.querySelector(".zoom-value")?.textContent')!=before else None, 'Two-finger pinch did not change zoom', 10)
    return {'before':before,'after':after}


def draw(tool, band):
    choose_tool(tool)
    paths[tool] = path_for_ink(band)
    before = {x['id'] for x in ink()}
    native_gesture(paths[tool])
    value = wait(lambda: next((x for x in ink() if x['kind']==tool and x['id'] not in before and x['points']>1), None), f'{tool} did not save real touch stroke', 20)
    assert not visible_id('[data-context-menu]'), 'Drawing opens an unwanted context menu'
    return value


def erase():
    choose_tool('eraser')
    before = sum(x['points'] for x in ink() if x['kind']=='marker')
    assert before > 0, 'No marker ink available'
    native_gesture(paths['marker'])
    after = wait(lambda: {'points': n} if (n:=sum(x['points'] for x in ink() if x['kind']=='marker'))<before else None, 'Eraser did not remove marker points', 20)
    assert any(x['kind']=='pen' for x in ink()), 'Eraser also removed the distant pencil stroke'
    assert not visible_id('[data-context-menu]'), 'Erasing opens an unwanted context menu'
    return {'before': before, 'after': after['points']}


def undo_redo():
    before = ink()
    click('button[aria-label="Отменить"]')
    restored = wait(lambda: ink() if ink()!=before else None, 'Undo did not restore document')
    click('button[aria-label="Повторить"]')
    wait(lambda: ink()==before, 'Redo did not restore exact previous ink')
    return {'undo': restored, 'redo': before}


def tools_menu():
    click('.mobile-tools-more,.toolbar-more')
    wait(lambda: visible_id('.mobile-tools-sheet,.lektrus-tool-overflow-content'), 'Full tool menu did not open')
    items=js('return [...document.querySelectorAll(".mobile-tools-sheet button,.lektrus-tool-overflow-content button")].filter(e=>e.getClientRects().length).map(e=>e.getAttribute("aria-label")||e.innerText).filter(Boolean)')
    screenshot('tool-catalogue-open')
    click('.mobile-tools-more,.toolbar-more')
    return items


def reopen():
    before = ink()
    assert any(x['kind']=='pen' for x in before), 'No persisted drawing to verify'
    click('.back-to-boards')
    wait(lambda: visible_id('.lectris-library-intro,.lektrus-calendar-grid'), 'Back to workspace failed', 45)
    if not visible_id('.lectris-library-intro'):
        click('.lectris-mobile-bottom button[aria-label="Доски"]')
    click('button[aria-label="Открыть доску Native QA"]')
    wait(lambda: visible_id('section.board'), 'Saved board did not reopen', 60)
    wait(lambda: js('return innerWidth>innerHeight'), 'Reopened board did not rotate')
    wait(lambda: ink()==before, 'Saved ink differs after reopening', 15)
    return before


def native_back_and_link():
    before = ink()
    path = js('return location.pathname')
    assert path.startswith('/board/'), 'No direct board route'
    if args.platform == 'android':
        context('NATIVE_APP')
        command('POST','/appium/device/press_keycode',{'keycode':4})
        context(web_context)
    else:
        click('.back-to-boards')
    wait(lambda: visible_id('.lectris-library-intro,.lektrus-calendar-grid'), 'Native back did not return to workspace', 45)
    url = 'ru.lektrus.board://' + path.lstrip('/')
    if args.platform == 'android':
        subprocess.run(['adb','shell','am','start','-a','android.intent.action.VIEW','-d',url,'ru.lektrus.board.dev'],check=True,timeout=30)
    else:
        subprocess.run(['xcrun','simctl','openurl',args.udid,url],check=True,timeout=30)
    wait(lambda: js('return location.pathname')==path and visible_id('section.board'), 'Native deep link did not open its board', 60)
    wait(lambda: ink()==before, 'Native back/deep link did not preserve drawing', 15)
    return {'route':path,'strokes':len(before)}


def create_session():
    common = {'platformName': 'Android' if args.platform=='android' else 'iOS',
              'appium:app': str(Path(args.app).resolve()), 'appium:newCommandTimeout': 180,
              'appium:automationName': 'UiAutomator2' if args.platform=='android' else 'XCUITest'}
    if args.platform=='android':
        # Debug APK intentionally has .dev applicationIdSuffix; the Java
        # namespace/activity remains unchanged. Never launch the release app.
        common.update({'appium:deviceName':'Android Emulator','appium:appPackage':'ru.lektrus.board.dev',
                       'appium:appActivity':'ru.lektrus.board.MainActivity','appium:ensureWebviewsHavePages':True,
                       'appium:autoGrantPermissions':True})
    else:
        common.update({'appium:udid':args.udid, 'appium:deviceName':'iPhone Simulator',
                       'appium:bundleId':'ru.lektrus.board','appium:wdaLaunchTimeout':180000,
                       'appium:wdaConnectionTimeout':180000, 'appium:showXcodeLog':True})
    return request('POST','/session',{'capabilities':{'alwaysMatch':common,'firstMatch':[{}]}}, timeout=420)


try:
    wait(lambda: request('GET','/status',timeout=3).get('ready'), 'Appium server unavailable', 90)
    session = create_session()['sessionId']
    print('Native session launched', session, flush=True)
    web_context = wait(lambda: next((c for c in command('GET','/contexts') if c.startswith('WEBVIEW')), None), 'No debuggable WebView in native app', 90)
    context(web_context)
    print('Native WebView attached', web_context, flush=True)
    assert js('return window.Capacitor?.isNativePlatform()'), 'Not a native Capacitor runtime'
    check('home-portrait-layout', home, fatal=True)
    check('more-and-native-keyboard', more)
    for label, route, selector in [
        ('Предметы','subjects','.lektrus-category-panel'),
        ('Группы и классы','groups','.lektrus-group-layout'),
        ('Ученики','students','.students-shell'),
        ('Задания','assignments','.assignments-shell'),
        ('Расписание','schedule','.schedule-shell'),
        ('Прогресс','progress','.progress-shell'),
        ('Материалы','materials','.materials-shell'),
        ('Шаблоны','templates','.templates-shell'),
        ('Уведомления','notifications','.notifications-shell'),
        ('Отзывы и предложения','feedback','.lektrus-feedback-screen'),
        ('Профиль','profile','.profile-only-shell'),
        ('Настройки','settings','.settings-shell'),
    ]:
        check('workspace-'+route, lambda: workspace_section(label, route, selector))
    check('create-board-and-landscape', open_new_board, fatal=True)
    check('board-landscape-bounds', board_layout)
    check('two-finger-pinch', pinch)
    check('pencil-touch', lambda: draw('pen',[.38,.46,.52]), fatal=True)
    check('marker-touch', lambda: draw('marker',[.68,.74,.60]))
    if any(x['kind']=='marker' for x in ink()):
        check('eraser-touch', erase)
    check('undo-redo', undo_redo)
    check('tool-catalogue', tools_menu)
    check('board-reopen-persistence', reopen)
    check('native-back-and-deep-link', native_back_and_link)
except Exception as error:
    print(traceback.format_exc(), file=sys.stderr, flush=True)
    results.append({'check':'runtime-aborted','status':'failed','detail':str(error)})
    if session:
        try:
            context('NATIVE_APP')
            (args.output/'runtime-aborted.png').write_bytes(base64.b64decode(command('GET','/screenshot')))
        except Exception:
            pass
finally:
    (args.output/'report.json').write_text(json.dumps({'platform': args.platform, 'results': results}, ensure_ascii=False, indent=2))
    if session:
        try:
            command('DELETE','')
        except Exception:
            pass
    print(json.dumps(results, ensure_ascii=False), flush=True)

sys.exit(0 if results and all(r['status']=='passed' for r in results) else 1)
