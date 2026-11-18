"""Offline native Appium acceptance; the installed debug app is the test target.

No browser emulation, production account, or synthetic DOM pointer events.
DOM reads select/measure controls; all clicks and gestures go through WebDriver.
"""
import argparse
import base64
import json
import shlex
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
parser.add_argument('--wda-app')
parser.add_argument('--wda-derived-data')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
URL = 'http://127.0.0.1:4723'
session = None
web_context = None
results = []
screenshot_evidence = []
ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'

class BlockedCheck(RuntimeError):
    """The installed app could not be exercised, e.g. remote map unavailable."""


def request(method, route, payload=None, timeout=180):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(URL + route, data=data, method=method,
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.load(response)['value']
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'{method} {route}: {error.read().decode()[:3500]}') from error


def command(method, route, payload=None, timeout=180):
    return request(method, f'/session/{session}{route}', payload, timeout)


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


def reattach_webview(seconds=45):
    global web_context
    # Web Inspector can expose a provisional/blank WKWebView before the
    # Capacitor bridge is injected (or stale pages from another context).
    # Merely finding documentElement is not proof the installed app is ready.
    def native_document():
        return js('return !!document.documentElement && window.Capacitor?.isNativePlatform?.()===true')
    def attach():
        try:
            current=command('GET','/context')
            if current and current.startswith('WEBVIEW') and native_document():
                return current
        except Exception:
            pass
        candidates=[c for c in command('GET','/contexts') if c.startswith('WEBVIEW')]
        for candidate in candidates:
            try:
                context(candidate)
                if not native_document():
                    continue
                return candidate
            except Exception:
                continue
        return None
    web_context=wait(attach,'Native WebView context unavailable',seconds)
    return web_context


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
    # Platform-native screenshot avoids switching Appium contexts between
    # every check, especially while a keyboard or new activity is opening.
    path=args.output / f'{label}.png'
    errors=[]
    try:
        if args.platform=='android':
            result=subprocess.run(['adb','exec-out','screencap','-p'],check=True,capture_output=True,timeout=15)
            raw=result.stdout
        else:
            subprocess.run(['xcrun','simctl','io',args.udid,'screenshot',str(path)],check=True,timeout=15,capture_output=True)
            raw=path.read_bytes()
        if not raw.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Native screenshot was not a PNG')
        path.write_bytes(raw)
        screenshot_evidence.append({'label':label,'status':'captured','method':'platform'})
        return True
    except Exception as error:
        errors.append(str(error))
    # Simulator capture may fail independently of the installed app. Use the
    # existing Appium context, without disturbing the keyboard/activity state.
    try:
        raw=base64.b64decode(command('GET','/screenshot',timeout=15),validate=True)
        if not raw.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('WebDriver screenshot was not a PNG')
        path.write_bytes(raw)
        screenshot_evidence.append({'label':label,'status':'captured','method':'webdriver','platform_error':errors[0]})
        print(f'CAPTURE FALLBACK: {label}: {errors[0]}',flush=True)
        return True
    except Exception as error:
        errors.append(str(error))
        screenshot_evidence.append({'label':label,'status':'missing','errors':errors})
        print(f'CAPTURE MISSING: {label}: {errors}',flush=True)
        return False


def check(name, fn, fatal=False):
    try:
        detail = fn()
        captured=screenshot(f'{len(results)+1:02d}-{name}')
        results.append({'check': name, 'status': 'passed', 'detail': detail, 'screenshot':captured})
        print(f'PASS: {name}: {detail}', flush=True)
    except Exception as error:
        detail=str(error)
        driver_lost=('Native WebView context unavailable' in detail or
                     ('/execute/sync' in detail and 'Method is not implemented' in detail) or
                     any(message in detail.casefold() for message in ('invalid session id','device offline','device not found','no such session','connection refused','socket hang up','not connected to devtools')))
        blocked=driver_lost or isinstance(error,BlockedCheck)
        results.append({'check': name, 'status': 'blocked' if blocked else 'failed', 'detail': detail})
        print(f'{"BLOCKED" if blocked else "FAIL"}: {name}: {error}', flush=True)
        try:
            screenshot(f'{len(results):02d}-{name}-failure')
        except Exception:
            pass
        if fatal:
            raise
        if driver_lost:
            # Do not inflate the error count by replaying later tests in a
            # disconnected native session. Attempt recovery once; otherwise
            # the report marks all remaining work as blocked.
            reattach_webview(60)
        elif name in ('table-edit-and-save','checklist-edit-and-save','flashcard-edit-and-save','quiz-edit-and-save'):
            # An unsuccessful editor must not block unrelated later checks.
            # Capture the failure first, then cancel through the actual UI.
            try:
                for kind in ('table','checklist','flashcard','quiz'):
                    if visible_id(f'.{kind}-editor-modal'):
                        # Cancel is the third checklist button; the others
                        # have one secondary action. Avoid :has on Android 11.
                        button=f'.{kind}-editor-footer button.secondary'+(':nth-child(3)' if kind=='checklist' else '')
                        click(button)
                        wait(lambda:not visible_id(f'.{kind}-editor-modal'),'Failed editor did not close',10)
                        print(f'Cleanup: cancelled {kind} editor after failure',flush=True)
            except Exception as cleanup_error:
                print(f'Cleanup failed: {cleanup_error}',flush=True)


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
    if args.platform == 'ios':
        scale = js('return visualViewport?.scale || 1')
        assert abs(scale - 1) < .02, f'iOS page zoom changed native viewport: {scale}; {report}'
    assert report['scrollWidth'] <= report['width'] + 2, report
    assert not report['issues'], report
    return report


def home():
    wait(lambda: visible_id('.lektrus-calendar-grid'), 'Workspace not rendered', 90)
    report = check_layout(['.lectris-mobile-bottom', '.lectris-mobile-bottom button', '.lectris-workspace-header'])
    report['screen'] = js('return {width:screen.width,height:screen.height,availableHeight:screen.availHeight,ratio:devicePixelRatio}')
    report['headerAndHero'] = js('''const h=document.querySelector('.lectris-workspace-header'), r=h.getBoundingClientRect(), p=parseFloat(getComputedStyle(h).paddingTop)||0;
      const controls=[...h.querySelectorAll('.lectris-brand,.lectris-header-actions')].map(e=>e.getBoundingClientRect());
      const copy=document.querySelector('.lectris-hub-hero-copy').getBoundingClientRect(), actions=document.querySelector('.lectris-hub-hero-actions').getBoundingClientRect();
      return {headerHeight:r.height,paddingTop:p,headerOverflow:controls.some(e=>e.top<r.top+p-2||e.bottom>r.bottom+2),heroGap:actions.top-copy.bottom};''')
    assert not report['headerAndHero']['headerOverflow'], report
    assert report['headerAndHero']['heroGap'] <= 32, report
    return report


def more():
    click('.lectris-mobile-bottom button[aria-label="Ещё разделы"]')
    wait(lambda: visible_id('.lektrus-more-page'), 'More page not rendered')
    full_height=js('return visualViewport?.height||innerHeight')
    click('.lektrus-more-page-search input')
    # Actual native input/keyboard path; query must filter the list.
    element = visible_id('.lektrus-more-page-search input')
    command('POST', f'/element/{element}/value', {'text': 'Настройки', 'value': list('Настройки')})
    wait(lambda: js('return [...document.querySelectorAll(".lektrus-more-page-item")].some(e=>e.innerText.includes("Настройки"));'), 'Settings filter unavailable')
    if args.platform == 'ios':
        scale = js('return visualViewport?.scale || 1')
        assert abs(scale - 1) < .02, f'Focusing search zoomed native viewport: {scale}'
    assert js('return document.activeElement===document.querySelector(".lektrus-more-page-search input")'), 'Search field was not focused before outside tap'
    keyboard_height=js('return visualViewport?.height||innerHeight')
    click('.lektrus-more-page-title h1')
    wait(lambda: js('return document.activeElement!==document.querySelector(".lektrus-more-page-search input")'), 'Outside tap did not dismiss keyboard')
    assert js('return document.querySelector(".lektrus-more-page-search input").value') == 'Настройки'
    if full_height-keyboard_height>50:
        wait(lambda:js('return visualViewport?.height||innerHeight')>=full_height-24,'Native keyboard still consumes screen space after outside tap',15)
    return {'items': js('return [...document.querySelectorAll(".lektrus-more-page-item")].map(e=>e.innerText)'), 'outsideTapDismissedKeyboard': True,'viewportBefore':full_height,'viewportWhileTyping':keyboard_height,'viewportAfter':js('return visualViewport?.height||innerHeight')}


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
    # Keep the action reachable while the native keyboard is still shown.
    # A WebDriver click can first dismiss the keyboard on old Chromium; use
    # an actual touch on the visible submit button rather than a DOM click.
    coords=js('''const r=document.querySelector('.lektrus-create-dialog button[type="submit"]').getBoundingClientRect();
      const x=Math.round(r.x+r.width/2), y=Math.round(r.y+r.height/2);
      const v=visualViewport, top=v?.offsetTop||0, bottom=top+(v?.height||innerHeight);
      return {x,y,viewport:[innerWidth,innerHeight],visualViewport:[top,bottom],button:[r.top,r.bottom],visible:r.top>=top&&r.bottom<=bottom+1&&!!document.elementFromPoint(x,y)?.closest('button[type="submit"]')};''')
    assert coords['visible'], f'Create button inaccessible with native keyboard: {coords}'
    js('''window.__boardLoadingFrames=[];window.__boardLoadingObserve=true;window.__createTouchEvents=[];
      for(const name of ['pointerdown','pointerup','click','submit','focusout'])document.addEventListener(name,e=>{
      if(window.__createTouchEvents.length<40)window.__createTouchEvents.push({type:name,target:e.target.tagName,button:e.target.closest('button')?.textContent,point:[e.clientX,e.clientY],active:document.activeElement?.tagName,visualTop:visualViewport?.offsetTop})},true);
      const sample=()=>{if(!window.__boardLoadingObserve)return;const e=document.querySelector('.lektrus-board-loading');
      if(e&&e.getClientRects().length&&window.__boardLoadingFrames.length<240)window.__boardLoadingFrames.push({viewport:[innerWidth,innerHeight],loader:[e.offsetWidth,e.offsetHeight],transform:getComputedStyle(e).transform});requestAnimationFrame(sample)};requestAnimationFrame(sample);''')
    native_gesture([(coords['x'],coords['y'])])
    try:
        wait(lambda: visible_id('section.board'), 'Board not rendered', 90)
    except Exception:
        print('Create board touch diagnostic',coords,js('return {events:window.__createTouchEvents,dialog:!!document.querySelector(".lektrus-create-dialog"),path:location.pathname,active:document.activeElement?.tagName,visualHeight:visualViewport?.height}'),flush=True)
        raise
    wait(lambda: js('return innerWidth>innerHeight'), 'Board failed to rotate to landscape', 30)
    frames=js('window.__boardLoadingObserve=false;return window.__boardLoadingFrames||[];')
    assert all(f['loader'][0]>=f['loader'][1] for f in frames), f'Board loading rendered vertically: {frames[:5]}'
    assert js('return document.querySelector(".board-title")?.value') == 'Native QA', 'Board title did not persist'
    return {'viewport': js('return [innerWidth, innerHeight]'), 'path': js('return location.pathname'), 'createButtonWithKeyboard':coords, 'landscapeLoadingFrames':len(frames), 'firstLoadingFrame':frames[0] if frames else None}


def recover_board_after_create_failure():
    """Keep the failed IME scenario failed, but exercise the board afterwards."""
    if not visible_id('section.board'):
        assert visible_id('.lektrus-create-dialog'),'Create failed and no recoverable form remains'
        click('.lektrus-create-dialog h2')
        wait(lambda:js('return !document.activeElement?.matches("input,textarea")'),'Recovery outside tap did not dismiss keyboard',15)
        wait(lambda:js('return !visualViewport||visualViewport.height>=innerHeight-5'),'Recovery keyboard viewport did not expand',15)
        click('.lektrus-create-dialog button[type="submit"]')
        wait(lambda:visible_id('section.board'),'Recovery could not open board with keyboard closed',60)
    wait(lambda:js('return innerWidth>innerHeight'),'Recovered board did not rotate',30)
    assert js('return document.querySelector(".board-title")?.value')=='Native QA','Recovered board did not retain entered title'
    print('Recovery: board opened via normal UI with keyboard closed; original keyboard-submit scenario remains failed',flush=True)


def board_layout():
    report = check_layout(['.topbar', '.back-to-boards', '.board-title', '.board-controls', '.mobile-undo-redo', '.mobile-undo-redo button'])
    assert visible_id('.mobile-undo-redo button[aria-label="Отменить"]'), 'Native undo must be visible after rotation'
    assert visible_id('.mobile-undo-redo button[aria-label="Повторить"]'), 'Native redo must be visible after rotation'
    assert js('return document.querySelector(".mobile-undo-redo").getBoundingClientRect().top >= document.querySelector(".topbar").getBoundingClientRect().bottom - 2'), 'History controls overlap board header'
    hint = js('return document.querySelector(".coordinates")?.textContent || ""')
    assert 'ЛКМ' not in hint and 'ПКМ' not in hint, f'Desktop-only hint on touch device: {hint}'
    return report


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
    viewport = js('return [innerWidth,innerHeight,visualViewport?.offsetLeft||0,visualViewport?.offsetTop||0,devicePixelRatio,window.__lektrusQaNativeWebViewRect||null]')
    def finger(pts, name, rect, sx, sy):
        coords = [(round(rect['x']+x*sx), round(rect['y']+y*sy)) for x, y in pts]
        actions = [{'type':'pointerMove','duration':0,'x':coords[0][0],'y':coords[0][1],'origin':'viewport'},
                   {'type':'pointerDown','button':0}, {'type':'pause','duration':80}]
        actions.extend({'type':'pointerMove','duration':80,'x':x,'y':y,'origin':'viewport'} for x,y in coords[1:])
        actions.append({'type':'pointerUp','button':0})
        return {'type':'pointer','id':name,'parameters':{'pointerType':'touch'},'actions':actions}
    def perform(rect,sx,sy):
        actions=[finger(points,'finger1',rect,sx,sy)]
        if second:
            actions.append(finger(second,'finger2',rect,sx,sy))
        command('POST','/actions',{'actions':actions})
        command('DELETE','/actions')
    context('NATIVE_APP')
    try:
        classname = 'android.webkit.WebView' if args.platform == 'android' else 'XCUIElementTypeWebView'
        try:
            element = wait(lambda:command('POST','/element',{'using':'class name','value':classname})[ELEMENT], 'Native WebView accessibility element unavailable', 5)
            rect = command('GET', f'/element/{element}/rect')
        except Exception as error:
            # Android accessibility can omit the WebView even when its actual
            # native surface is visible. Recover *native* touch using the
            # current screen rectangle measured by the debug activity.
            if args.platform=='android' and viewport[5]:
                measured=viewport[5]
                ratio=viewport[4]
                if (abs(measured['width']/viewport[0]-ratio)<.06 and
                    abs(measured['height']/viewport[1]-ratio)<.06 and
                    measured['x']>=0 and measured['y']>=0):
                    print('Native accessibility WebView missing; using measured native surface',measured,flush=True)
                    perform(measured,ratio,ratio)
                    return
            # Single taps can also use the driver's WebView touch injection;
            # never substitute that for native multitouch or drag coverage.
            if args.platform!='android' or second or len(points)!=1:
                raise BlockedCheck(f'Native WebView touch surface unavailable: {error}') from error
            reattach_webview()
            print('Native accessibility WebView missing; using installed WebView touch input',flush=True)
            perform({'x':0,'y':0},1,1)
            return
        sx, sy = rect['width']/viewport[0], rect['height']/viewport[1]
        if args.platform=='ios':
            # WKWebView's layout height can exclude part of the device screen
            # while its native accessibility frame still covers the full view.
            # CSS pixels scale equally on both axes, not with keyboard height.
            sy=sx
            # DOM hit-test rectangles already include the visual viewport's
            # displacement. Subtracting it again taps above the visible field.
        # Physical pixels for Android, coordinate points for iOS. The native
        # WebView rect includes the actual OS bars/insets, not browser guesses.
        assert 0.5 <= sx <= 5 and 0.5 <= sy <= 5, (rect, viewport)
        perform(rect,sx,sy)
    finally:
        reattach_webview()


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


def navigation_dock_layout():
    # Ink settings and board zoom must not cover the clickable miniature map.
    choose_tool('pen')
    report=js('''const sel=['.minimap','.board-controls','.mobile-undo-redo'];
      const out={}; for(const s of sel){const e=document.querySelector(s);if(!e||!e.getClientRects().length)continue;
        const r=e.getBoundingClientRect();out[s]=[r.left,r.top,r.right,r.bottom];}
      return out;''')
    assert '.board-controls' in report and '.mobile-undo-redo' in report,report
    if '.minimap' in report:
        r=report['.minimap']
        assert r[3] <= report['.board-controls'][1]-3, f'Minimap overlaps zoom: {report}'
        assert r[1] >= report['.mobile-undo-redo'][3]-2, f'Minimap overlaps history: {report}'
        assert js('''const e=document.querySelector('.minimap-world'),r=e.getBoundingClientRect();
          return Boolean(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('.minimap-world'));'''), 'Minimap center is not clickable'
    return report


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
        # Sending the actual system key through ADB avoids disconnecting
        # Chromedriver during the portrait/landscape activity transition.
        subprocess.run(['adb','shell','input','keyevent','4'],check=True,timeout=30)
    else:
        click('.back-to-boards')
    wait(lambda: visible_id('.lectris-library-intro,.lektrus-calendar-grid'), 'Native back did not return to workspace', 45)
    url = 'ru.lektrus.board://' + path.lstrip('/')
    if args.platform == 'android':
        subprocess.run(['adb','shell','am','start','-a','android.intent.action.VIEW','-d',url,'ru.lektrus.board.dev'],check=True,timeout=30)
    else:
        subprocess.run(['xcrun','simctl','openurl',args.udid,url],check=True,timeout=30)
    try:
        wait(lambda: js('return location.pathname')==path and visible_id('section.board'), 'Native deep link did not open its board', 60)
    except Exception:
        print('Deep-link diagnostic', {'expected':path,'actual':js('return location.pathname'), 'boardVisible': bool(visible_id('section.board'))}, flush=True)
        if args.platform=='android':
            logs=subprocess.run(['adb','logcat','-d','-s','Capacitor','Capacitor/AppPlugin','Capacitor/Console'],capture_output=True,text=True,timeout=20)
            (args.output/'native-link-logcat.txt').write_text(logs.stdout[-150000:])
        print('Native URL parser diagnostic', js('const u=new URL(arguments[0]);return {protocol:u.protocol,hostname:u.hostname,pathname:u.pathname,port:u.port,username:u.username}',url), flush=True)
        raise
    wait(lambda: ink()==before, 'Native back/deep link did not preserve drawing', 15)
    return {'route':path,'strokes':len(before)}


def native_picker_button(labels):
    attributes = ('text','content-desc') if args.platform=='android' else ('label','name')
    predicate=' or '.join(f'@{attr}="{label}"' for attr in attributes for label in labels)
    try:
        elements=command('POST','/elements',{'using':'xpath','value':'//*['+predicate+']'})
        return next((e[ELEMENT] for e in elements if ELEMENT in e), None)
    except RuntimeError:
        return None


def start_native_export(label):
    js('''window.__nativeExportNotices=[]; new MutationObserver(()=>{const n=document.querySelector('.board-system-notice');if(n)window.__nativeExportNotices.push(n.innerText)}).observe(document.body,{childList:true,subtree:true,characterData:true});''')
    if not visible_id('.topbar-more-menu[open] .topbar-more-popover'):
        click('.topbar-more-menu>summary')
    wait(lambda:visible_id('.topbar-more-menu[open] .topbar-more-popover'),'Board action menu did not open')
    for _ in range(12):
        target=js('''const menu=document.querySelector('.topbar-more-menu[open] .topbar-more-popover');if(!menu)return null;
          const m=menu.getBoundingClientRect(),e=[...menu.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0]);if(!e)return null;
          const r=e.getBoundingClientRect(),x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2);
          const style=getComputedStyle(menu);
          return {x,y,left:m.left,right:m.right,top:m.top,bottom:m.bottom,viewport:innerHeight,visualHeight:visualViewport?.height,visualTop:visualViewport?.offsetTop,maxHeight:style.maxHeight,inlineMaxHeight:menu.style.maxHeight,overflow:style.overflowY,scrollHeight:menu.scrollHeight,clientHeight:menu.clientHeight,hit:e.contains(document.elementFromPoint(x,y))};''',label)
        assert target,f'Menu action missing: {label}'
        assert target['top']>=0 and target['bottom']<=target['viewport']+2,f'Board action menu extends outside viewport: {target}'
        if target['hit'] and target['top']<=target['y']<=target['bottom']:
            # This tap launches a different OS activity; do not reattach to
            # the WebView until the picker has returned its actual result.
            click_text('.topbar-more-popover button',label);break
        x=round((target['left']+target['right'])/2)
        lo,hi=round(target['top']+10),round(target['bottom']-10)
        start,end=(hi,lo) if target['y']>target['bottom'] else (lo,hi)
        native_gesture([(x,round(start+(end-start)*i/8)) for i in range(9)])
    else:
        raise AssertionError(f'Board action remained inaccessible after scrolling: {label}')
    # OS file chooser is outside the installed WebView; DOM clicks are not
    # sufficient evidence that a bytes-on-disk native export occurred.
    context('NATIVE_APP')


def native_file_export_save():
    name='Native QA.orboard'
    start_native_export('Скачать копию')
    try:
        save=wait(lambda:native_picker_button(('Save','SAVE','Сохранить')),'Native system file picker did not offer Save',45)
        screenshot('native-board-save-picker')
        if args.platform=='ios':
            local=native_picker_button(('On My iPhone','На iPhone'))
            if local:
                command('POST',f'/element/{local}/click',{})
                save=wait(lambda:native_picker_button(('Save','SAVE','Сохранить')),'Local file destination not selectable',20)
        command('POST',f'/element/{save}/click',{})
    finally:
        reattach_webview()
    wait(lambda: js('return window.__nativeExportNotices?.some(n=>n.includes("Копия"))'),'Native save completion not acknowledged',30)
    if args.platform=='android':
        escaped=shlex.quote(name)
        locations=subprocess.run(['adb','shell',f'find /sdcard/Download /sdcard/Documents -maxdepth 3 -name {escaped} 2>/dev/null'],capture_output=True,text=True,timeout=20).stdout.splitlines()
        assert locations,'Saved board not found in Android shared storage'
        # The filename contains spaces. Pull bytes with the ADB file protocol
        # instead of relying on a remote shell to preserve argument quoting.
        exported=args.output/'native-exported-board.orboard'
        subprocess.run(['adb','pull',locations[0].strip(),str(exported)],check=True,capture_output=True,timeout=25)
        raw=exported.read_bytes()
    else:
        container=Path(subprocess.check_output(['xcrun','simctl','get_app_container',args.udid,'ru.lektrus.board','data'],text=True,timeout=20).strip())
        # Look in this isolated simulator's shared/local Files containers only;
        # the private staging directory is deleted before the app reports success.
        root=container.parents[2]
        locations=[p for p in root.rglob(name) if p.is_file() and 'lektrus-export-' not in str(p)]
        assert locations,'Saved board not found in iPhone simulator Files storage'
        raw=locations[0].read_bytes()
    assert raw and raw.lstrip().startswith(b'{'),f'Exported board is not JSON: {len(raw)} bytes; first bytes={raw[:80]!r}'
    bundle=json.loads(raw)
    assert bundle['format']=='onlinerepetitor-board' and bundle['version']==2,bundle.keys()
    assert any(i['kind']=='pen' for i in bundle['document']['items']),'Export omitted the saved drawing'
    return {'bytes':len(raw),'name':name,'containsPen':True}


def native_file_export_cancel():
    start_native_export('Экспорт PNG')
    try:
        wait(lambda:native_picker_button(('Save','SAVE','Сохранить')),'PNG did not reach native file picker',45)
        screenshot('native-png-save-picker')
        if args.platform=='android':
            subprocess.run(['adb','shell','input','keyevent','4'],check=True,timeout=20)
        else:
            cancel=wait(lambda:native_picker_button(('Cancel','CANCEL','Отмена')),'Native picker Cancel missing',15)
            command('POST',f'/element/{cancel}/click',{})
    finally:
        reattach_webview()
    wait(lambda:js('return window.__nativeExportNotices?.some(n=>n.includes("Сохранение отменено"))'),'Cancelling native save reported no cancellation',30)
    return {'cancelled':True}


def board_items():
    return js('''const id=location.pathname.split('/').pop();
      for(const k of Object.keys(localStorage).filter(k=>k.includes('.local-test.board.')&&k.endsWith(id))){
        const d=JSON.parse(localStorage.getItem(k));if(Array.isArray(d?.items))return d.items;
      }return [];''')


def item_by_id(item_id):
    return next((i for i in board_items() if i['id']==item_id), None)


def click_text(selector, label):
    element=wait(lambda: js('return [...document.querySelectorAll(arguments[0])].find(e=>e.getClientRects().length&&e.textContent.trim()===arguments[1])||null;',selector,label),f'Visible control: {label}')
    command('POST',f'/element/{element[ELEMENT]}/click',{})


def pick_element(selector, label=None):
    if not visible_id('.mobile-tools-sheet'):
        click('.mobile-tools-more')
    wait(lambda: visible_id('.mobile-tools-sheet'),'Mobile tool catalogue unavailable')
    for _ in range(20):
        data=js('''const panel=document.querySelector('.mobile-tools-sheet'), pr=panel.getBoundingClientRect();
          const scroll=panel.querySelector('.mobile-tools-groups')||panel, sr=scroll.getBoundingClientRect();
          const header=panel.querySelector('.mobile-tools-sheet-head').getBoundingClientRect();
          const e=[...panel.querySelectorAll(arguments[0])].find(e=>arguments[1]===null||e.textContent.trim()===arguments[1]);
          if(!e)return null;
          const r=e.getBoundingClientRect(), x=Math.round(r.x+r.width/2), y=Math.round(r.y+r.height/2);
          const hit=document.elementFromPoint(x,y);
          return {x,y,hit:!!hit&&(e===hit||e.contains(hit)),top:Math.max(pr.top,sr.top,header.bottom),
            bottom:Math.min(pr.bottom,sr.bottom,innerHeight),left:sr.left,right:sr.right,scroll:scroll.scrollTop,scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight};''',selector,label)
        assert data, f'Missing catalogue tool: {selector} {label}'
        if data['hit'] and data['top']<=data['y']<=data['bottom']:
            native_gesture([(data['x'],data['y'])])
            wait(lambda:not visible_id('.mobile-tools-sheet'),'Catalogue did not close after selecting tool')
            return
        x=round((data['left']+data['right'])/2)
        lo,hi=round(data['top']+12),round(data['bottom']-12)
        assert hi-lo>30, f'Catalogue has insufficient scroll area: {data}'
        start,end=(hi,lo) if data['y']>data['bottom'] else (lo,hi)
        native_gesture([(x,round(start+(end-start)*i/8)) for i in range(9)])
    raise AssertionError(f'Catalogue tool blocked after native scrolling: {selector} {data}')


def open_point():
    p=js('''const b=document.querySelector('section.board').getBoundingClientRect();
       const blocked='.board-object,.screen-transform-overlay,.selection-toolbar-screen,button,input,textarea,.toolbar,.board-controls,.mobile-board-tools,.topbar,.minimap,[data-board-interactive]';
       for(const y of [.49,.42,.57,.66,.35,.74,.28,.81,.21,.88])for(const x of [.52,.38,.66,.30,.24,.76,.18,.82,.12,.88]){
          const p=[Math.round(b.left+b.width*x),Math.round(b.top+b.height*y)];
          const e=document.elementFromPoint(...p);if(e?.closest('section.board')&&!e.closest(blocked)&&e!==document.querySelector('.topbar'))return p;
       }return null;''')
    assert p,'No unobstructed object placement point'
    return p


def zoom_for_objects():
    choose_tool('select')
    percent=lambda:int(js('return parseInt(document.querySelector(".zoom-value").textContent,10)'))
    before=percent()
    if before>115 or before<65:
        w,h=js('return [innerWidth,innerHeight]')
        x,y=round(w*.52),round(h*.46)
        start=80 if before>115 else 22
        end=max(12,min(100,round(start*85/before)))
        distances=[round(start+(end-start)*i/8) for i in range(9)]
        native_gesture([(x-d,y) for d in distances],[(x+d,y) for d in distances])
        wait(lambda: 40<=percent()<=145,'Unable to obtain useful board scale',12)
    return {'before':before,'after':percent()}


def create_item(kind, selector, label=None):
    before={i['id'] for i in board_items()}
    pick_element(selector,label)
    native_gesture([tuple(open_point())])
    return wait(lambda:next((i for i in board_items() if i['kind']==kind and i['id'] not in before),None),f'{kind} not created by touch',20)


def handle_point(selector):
    point=js('''const e=document.querySelector(arguments[0]);if(!e)return null;const r=e.getBoundingClientRect();
      const x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2);
      if(x<0||y<0||x>=innerWidth||y>=innerHeight)return null;
      const hit=document.elementFromPoint(x,y);return hit&&(e===hit||e.contains(hit))?[x,y]:null;''',selector)
    assert point,f'Transform handle blocked or outside viewport: {selector}'
    return tuple(point)


def drag_handle(selector, dx, dy):
    x,y=handle_point(selector)
    native_gesture([(round(x+dx*i/8),round(y+dy*i/8)) for i in range(9)])


def create_shape():
    item=create_item('shape','.lektrus-elements-shape-grid button[title="Прямоугольник"]')
    assert item['shapeType']=='rectangle',item
    paths['shape_id']=item['id']
    wait(lambda:visible_id('.screen-transform-overlay'),'New shape is not selected')
    return {k:item[k] for k in ('id','shapeType','x','y','width','height')}


def move_shape():
    original=item_by_id(paths['shape_id'])
    drag_handle('.lektrus-selection-move-grip',45,12)
    changed=wait(lambda: (i if (i:=item_by_id(original['id'])) and i['x']>original['x']+5 else None),'Touch drag did not move shape')
    assert changed['width']==original['width'] and changed['height']==original['height'],changed
    return {'before':[original['x'],original['y']],'after':[changed['x'],changed['y']]}


def resize_shape():
    original=item_by_id(paths['shape_id'])
    drag_handle('.screen-resize-handle[data-transform-handle="se"]',30,20)
    changed=wait(lambda:(i if (i:=item_by_id(original['id'])) and i['width']>original['width']+4 and i['height']>original['height']+4 else None),'Touch resize did not enlarge shape',20)
    return {'before':[original['width'],original['height']],'after':[changed['width'],changed['height']]}


def shape_actions():
    item_id=paths['shape_id']
    def selection_dock():
        report=js('''const r=document.querySelector('.selection-toolbar-screen').getBoundingClientRect();
          const docks=['.board-controls','.minimap','.mobile-undo-redo','nav.mobile-board-tools','.topbar'];
          return {selection:[r.left,r.top,r.right,r.bottom],overlaps:docks.filter(s=>{
            const e=document.querySelector(s);if(!e||!e.getClientRects().length)return false;
            const d=e.getBoundingClientRect();return Math.min(r.right,d.right)-Math.max(r.left,d.left)>1&&Math.min(r.bottom,d.bottom)-Math.max(r.top,d.top)>1;
          })};''')
        assert not report['overlaps'], f'Selection actions collide with the board chrome: {report}'
        return report
    selection_dock()
    click('.selection-toolbar-screen button[title^="Повернуть на 90° вправо"]')
    rotated=wait(lambda:(i if (i:=item_by_id(item_id)) and round(i.get('rotation',0))%360==90 else None),'Rotation not persisted')
    click('.selection-toolbar-screen .selection-more summary')
    wait(lambda:visible_id('.selection-more[open] .selection-more-menu'),'Selection actions menu not visible')
    menu=js('''const e=document.querySelector('.selection-more[open] .selection-more-menu button');
      const r=e.getBoundingClientRect(), x=r.left+r.width/2,y=r.top+r.height/2;
      return {reachable:e.contains(document.elementFromPoint(x,y)),rect:[r.left,r.top,r.right,r.bottom]};''')
    assert menu['reachable'], f'Selection menu painted behind other layers: {menu}'
    click('.selection-toolbar-screen .selection-more summary')
    wait(lambda:not visible_id('.selection-more[open] .selection-more-menu'),'Selection actions menu did not close')
    click('.selection-toolbar-screen button[title^="Дублировать"]')
    duplicate=wait(lambda:next((i for i in board_items() if i['kind']=='shape' and i['id']!=item_id),None),'Shape duplication not persisted')
    assert duplicate['shapeType']==rotated['shapeType'] and duplicate['width']==rotated['width'],duplicate
    selection_dock()
    click('.selection-toolbar-screen .selection-toolbar-danger')
    wait(lambda:item_by_id(duplicate['id']) is None,'Duplicate not deleted')
    # Delete original using its visible object and button, keeping board clear for text/table.
    click(f'.board-object[data-object="{item_id}"]')
    click('.selection-toolbar-screen .selection-toolbar-danger')
    wait(lambda:item_by_id(item_id) is None,'Original shape not deleted')
    return {'rotation':rotated['rotation'],'duplicate':duplicate['id'],'deleted':True,'selectionDockNoOverlap':True}


def type_into(selector, value, clear=False, outside=None):
    element=click(selector)
    if clear:
        # React-controlled cells must receive a real deletion input event:
        # some old/WebKit drivers clear only the DOM, leaving state unchanged.
        old_value=js('return document.querySelector(arguments[0]).value',selector)
        if old_value:
            modifier='\ue009' if args.platform=='android' else '\ue03d'
            command('POST','/actions',{'actions':[{'type':'key','id':'keyboard','actions':[
                {'type':'keyDown','value':modifier},{'type':'keyDown','value':'a'},
                {'type':'keyUp','value':'a'},{'type':'keyUp','value':modifier},
                {'type':'keyDown','value':'\ue003'},{'type':'keyUp','value':'\ue003'}]}]})
            command('DELETE','/actions')
            if js('return document.querySelector(arguments[0]).value',selector):
                if args.platform=='android':
                    # Some Chromium WebViews swallow the Ctrl+A combination
                    # sent by Chromedriver. Real Android hardware key events
                    # delete the existing text while keeping React in sync.
                    remaining=js('return document.querySelector(arguments[0]).value',selector)
                    subprocess.run(['adb','shell','input','keyevent','123',*(['67']*len(remaining))],check=True,timeout=25)
                else:
                    command('POST',f'/element/{element}/clear',{})
                    element=click(selector)
            wait(lambda:js('return document.querySelector(arguments[0]).value=== ""',selector),'Native keyboard did not clear previous text',10)
    command('POST',f'/element/{element}/value',{'text':value,'value':list(value)})
    try:
        wait(lambda:js('return document.querySelector(arguments[0])?.value===arguments[1]',selector,value),'Text input did not receive exact value',10)
    except AssertionError:
        raise AssertionError(f'Native input mismatch: {selector}, value={js("return document.querySelector(arguments[0])?.value",selector)!r}')
    if outside:
        # Exercise the same outside-tap behavior users use, not a synthetic
        # blur or a driver context transition while the keyboard is open.
        click(outside)
        wait(lambda:js('return document.activeElement!==document.querySelector(arguments[0])',selector),'Outside tap did not dismiss editor keyboard',15)
        assert js('return document.querySelector(arguments[0])?.value',selector)==value,'Outside tap lost typed text'
        # Native IME dismissal animates and can move the next control while
        # focus has already cleared. Require stable geometry before the next
        # physical interaction; otherwise a click can land on a shifted row.
        last=[None]
        def settled():
            current=js('return [innerHeight,visualViewport?.height,visualViewport?.offsetTop,document.querySelector(".lektrus-touch-editor-portal")?.getBoundingClientRect().height].map(v=>v==null?null:Math.round(v))')
            same=current==last[0]
            last[0]=current
            return same
        wait(settled,'Editor viewport did not settle after keyboard dismissal',10)
        return
    # Hiding the keyboard through the driver does not simulate DOM events and
    # makes footer actions reachable in a landscape WebView.
    if args.platform=='android':
        # The native keyboard is owned by Android, not the DOM. Avoid
        # switching away from Chromedriver while the IME is closing.
        ime=subprocess.run(['adb','shell','dumpsys','input_method'],capture_output=True,text=True,timeout=20,check=True).stdout
        if any(flag in ime for flag in ('mInputShown=true','mIsInputViewShown=true','mShowRequested=true')):
            subprocess.run(['adb','shell','input','keyevent','4'],timeout=20,check=True)
        wait(lambda:js('return !!document.documentElement'),'WebView not responsive after keyboard',15)
    else:
        try:
            context('NATIVE_APP')
            command('POST','/appium/device/hide_keyboard',{})
        except Exception:
            pass
        finally:
            reattach_webview()


def text_object(kind,label,value):
    item=create_item(kind,'.lektrus-elements-quick button',label)
    type_into('textarea.text-editor',value)
    click('.mobile-board-tools button[data-lektrus-hand-tool]')
    saved=wait(lambda:(i if (i:=item_by_id(item['id'])) and i.get('text')==value else None),'Edited text not saved to the document',20)
    assert not visible_id('textarea.text-editor'),'Text editor did not close'
    return {'id':saved['id'],'kind':kind,'text':saved['text']}


def table_editor():
    item=create_item('table','.lektrus-elements-data-action',None)
    wait(lambda:visible_id('.table-editor-modal'),'Table editor did not open')
    check_layout(['.table-editor-modal'])
    selector='.table-editor-grid textarea:first-of-type'
    type_into(selector,'Урок QA',clear=True,outside='.table-editor-header strong')
    click('.table-editor-footer button.primary')
    saved=wait(lambda:(i if (i:=item_by_id(item['id'])) and i.get('tableCells',[None])[0]=='Урок QA' else None),'Table cell not saved',20)
    assert saved['tableRows']==3 and saved['tableCols']==3,saved
    wait(lambda:js('''const e=document.querySelector('.back-to-boards'),r=e.getBoundingClientRect();
        const p=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return r.top>=0&&r.bottom<=innerHeight&&e.contains(p);'''),'Board header disappeared after closing table keyboard',12)
    return {'id':saved['id'],'rows':saved['tableRows'],'columns':saved['tableCols'],'cell':saved['tableCells'][0]}


def create_study_editor(kind, label, modal):
    before={i['id'] for i in board_items()}
    pick_element(f'button[aria-label^="{label}"]')
    native_gesture([tuple(open_point())])
    wait(lambda:visible_id(modal),f'{kind} editor did not open')
    assert not any(i['kind']==kind and i['id'] not in before for i in board_items()),'Uncommitted study object appeared on board'
    return before


def checklist_editor():
    before=create_study_editor('checklist','Чек-лист / задание','.checklist-editor-modal')
    header='.checklist-editor-header strong'
    count=lambda:js('return document.querySelectorAll(".checklist-editor-row").length')
    assert count()==1,'New checklist did not start with one row'
    type_into('.checklist-title-input input','План QA',clear=True,outside=header)
    type_into('.checklist-editor-row input[placeholder="Пункт 1"]','Чтение',clear=True,outside=header)
    assert count()==1,f'Outside tap added a checklist row: {count()}'
    click('.checklist-add-row')
    wait(lambda: count()>=2,'Add row click did not create a checklist row')
    assert count()==2,f'One Add row click created {count()} rows'
    type_into('.checklist-editor-row input[placeholder="Пункт 2"]','Задача',clear=True,outside=header)
    assert count()==2,f'Editing second row unexpectedly created {count()} rows'
    click('.checklist-editor-row:first-child .checklist-editor-check')
    click('.checklist-editor-footer button.primary')
    item=wait(lambda:next((i for i in board_items() if i['kind']=='checklist' and i['id'] not in before),None),'Saved checklist missing')
    assert item['text']=='План QA' and item['checklistItems']==['Чтение','Задача'] and item['checklistDone']==[True,False],item
    return {'id':item['id'],'items':item['checklistItems'],'done':item['checklistDone']}


def flashcard_editor():
    before=create_study_editor('flashcard','Карточка вопрос–ответ','.flashcard-editor-modal')
    header='.flashcard-editor-header strong'
    type_into('.flashcard-editor-compose textarea[placeholder="Что нужно вспомнить?"]','Столица России',clear=True,outside=header)
    type_into('.flashcard-editor-compose textarea[placeholder="Ответ или пояснение"]','Москва',clear=True,outside=header)
    click('.flashcard-editor-footer button.primary')
    item=wait(lambda:next((i for i in board_items() if i['kind']=='flashcard' and i['id'] not in before),None),'Saved flashcard missing')
    assert item['text']=='Столица России' and item['flashcardBack']=='Москва',item
    return {'id':item['id'],'front':item['text'],'back':item['flashcardBack']}


def quiz_editor():
    before=create_study_editor('quiz','Вопрос / мини-тест','.quiz-editor-modal')
    header='.quiz-editor-header strong'
    type_into('.quiz-question-editor textarea','2+2?',clear=True,outside=header)
    type_into('.quiz-editor-option input[placeholder="Вариант A"]','3',clear=True,outside=header)
    type_into('.quiz-editor-option input[placeholder="Вариант B"]','4',clear=True,outside=header)
    click('.quiz-editor-option:nth-child(2) .quiz-correct-radio')
    click('.quiz-editor-footer button.primary')
    item=wait(lambda:next((i for i in board_items() if i['kind']=='quiz' and i['id'] not in before),None),'Saved quiz missing')
    assert item['text']=='2+2?' and item['quizOptions']==['3','4'] and item['quizCorrect']==1,item
    return {'id':item['id'],'options':item['quizOptions'],'correct':item['quizCorrect']}


def formula_editor():
    before={i['id'] for i in board_items()}
    choose_subject_tool('Математика','Математическая формула')
    wait(lambda:visible_id('.formula-editor-modal'),'Formula editor not rendered')
    value='x^2+4=9'
    type_into('#formula-source',value,clear=True,outside='.formula-editor-header strong')
    assert visible_id('.formula-preview-card .formula-scripted'),'Formula preview did not render exponent'
    click('.formula-editor-footer button.primary')
    item=wait(lambda:next((i for i in board_items() if i['kind']=='formula' and i['id'] not in before),None),'Saved formula missing')
    assert item['text']==value,item
    return {'id':item['id'],'formula':item['text']}


def full_document_persistence():
    # The document schema materializes optional style defaults on reload.
    # Normalize only those exact defaults; compare every other persisted field.
    def normalized():
        items=board_items()
        for item in items:
            if item['kind'] in ('text','sticky'):
                for k,v in {'textAlign':'left','fontWeight':'normal','fontStyle':'normal','textDecoration':'none','textList':'none','lineHeight':1.45}.items():
                    item.setdefault(k,v)
            if item['kind']=='table':
                for k,v in {'tableAlign':'left','tableStripe':False,'tableCompact':False,'tableHeader':True}.items():
                    item.setdefault(k,v)
            for k in ('locked','hidden'):
                if item.get(k) is False:
                    item.pop(k)
        return items
    before=normalized()
    if not {'text','sticky','table'}.issubset({i['kind'] for i in before}):
        raise BlockedCheck('Object creation prerequisite incomplete; full persistence was not exercised')
    reopen()
    try:
        wait(lambda:normalized()==before,'Full model changed after saving/reopening',20)
    except AssertionError:
        after={i['id']:i for i in normalized()}
        differences=[{'kind':i['kind'],'id':i['id'],'changed':{k:[i.get(k),after.get(i['id'],{}).get(k)] for k in set(i)|set(after.get(i['id'],{})) if i.get(k)!=after.get(i['id'],{}).get(k)}} for i in before if i!=after.get(i['id'])]
        raise AssertionError(f'Persisted model differs: {json.dumps(differences,ensure_ascii=False)[:2500]}')
    return {'objects':len(before),'kinds':sorted(set(i['kind'] for i in before))}


SUBJECTS={
    'Математика':['Математическая формула','Дроби','Построение фигур','Координатная плоскость'],
    'Физика':['Механика','Оптика','Графики движения','Электрические цепи'],
    'Химия':['Периодическая система','Химические задания','Уравнения реакций','Органический редактор','Моделирование опытов'],
    'Биология':[],
    'География':['Географические карты','Контурная карта','Сопоставление','Карточки вопросов'],
    'Русский язык':[],
    'Литература':[],
    'История':['Исторические карты'],
    'Обществознание':[],
    'Информатика':[],
    'Иностранный язык':['Составление предложений','Карточки слов'],
}

EXPECTED_CHECKS=[
    'home-portrait-layout','more-and-native-keyboard',
    *['workspace-'+r for r in ('subjects','groups','students','assignments','schedule','progress','materials','templates','notifications','feedback','profile','settings')],
    'create-board-and-landscape','board-landscape-bounds','two-finger-pinch','pencil-touch','marker-touch',
    'eraser-touch','undo-redo','navigation-dock-no-overlap','tool-catalogue','board-reopen-persistence',
    'native-back-and-deep-link','zoom-for-object-tests','create-rectangle-touch','move-object-touch',
    'resize-object-touch','rotate-duplicate-delete','text-native-keyboard','sticky-native-keyboard',
    'table-edit-and-save','all-objects-reopen-persistence','checklist-edit-and-save','flashcard-edit-and-save','quiz-edit-and-save','formula-edit-and-save',
    *['subject-catalogue-'+str(i+1) for i in range(len(SUBJECTS))],
    'subject-math-geometry-editor','subject-physics-circuit-editor','subject-geography-atlas-editor',
    'subject-history-atlas-editor','subject-language-sentence-editor','subject-chemistry-lab-fullscreen',
    'native-file-export-save','native-file-export-cancel',
]
runtime_abort=None

def subject_panel(subject):
    if not visible_id('#lektrus-subject-tools-panel'):
        click('.lektrus-mobile-subject-trigger')
    wait(lambda:visible_id('#lektrus-subject-tools-panel'),'Subject panel did not open')
    selector='.lektrus-subject-tools-category select'
    if js('return document.querySelector(arguments[0]).value',selector)!=subject:
        option=js('return [...document.querySelector(arguments[0]).options].find(e=>e.value===arguments[1])',selector,subject)
        assert option, f'Subject option missing: {subject}'
        command('POST',f'/element/{option[ELEMENT]}/click',{})
        wait(lambda:js('return document.querySelector(arguments[0]).value===arguments[1]',selector,subject),'Subject change did not persist')
    expected=['Задания на доске',*SUBJECTS[subject]]
    labels=lambda:js('return Array.from(document.querySelectorAll(".lektrus-subject-tools-list button")).map(e=>e.getAttribute("aria-label"))')
    wait(lambda:sorted(labels())==sorted(expected), f'Subject tool catalogue mismatch, {subject}: {labels()}',10)
    bounds=check_layout(['#lektrus-subject-tools-panel','.lektrus-subject-tools-head','.lektrus-subject-tools-category select'])
    return {'subject':subject,'tools':labels(),'bounds':bounds}


def subject_catalogue(subject):
    result=subject_panel(subject)
    screenshot('subject-catalogue-'+str(list(SUBJECTS).index(subject)+1))
    click('.lektrus-subject-tools-head button')
    wait(lambda:not visible_id('#lektrus-subject-tools-panel'),'Subject panel did not close')
    return result


def choose_subject_tool(subject,label):
    subject_panel(subject)
    for _ in range(15):
        data=js('''const p=document.querySelector('.lektrus-subject-tools-body'),b=p.getBoundingClientRect();
          const e=[...p.querySelectorAll('.lektrus-subject-tools-list button')].find(e=>e.getAttribute('aria-label')===arguments[0]);
          const r=e.getBoundingClientRect(),x=Math.round(r.x+r.width/2),y=Math.round(r.y+r.height/2),hit=document.elementFromPoint(x,y);
          return {x,y,hit:!!hit&&(e===hit||e.contains(hit)),top:b.top,bottom:b.bottom,left:b.left,right:b.right};''',label)
        if data['hit'] and data['top']<=data['y']<=data['bottom']:
            native_gesture([(data['x'],data['y'])])
            wait(lambda:not visible_id('#lektrus-subject-tools-panel'),'Subject tool did not activate')
            return
        x=round((data['left']+data['right'])/2)
        lo,hi=round(data['top']+12),round(data['bottom']-12)
        assert hi-lo>25,data
        start,end=(hi,lo) if data['y']>data['bottom'] else (lo,hi)
        native_gesture([(x,round(start+(end-start)*i/8)) for i in range(9)])
    raise AssertionError(f'Subject tool blocked: {label}')


def subject_editor(subject,label,editor,close,action=None):
    choose_subject_tool(subject,label)
    wait(lambda:visible_id(editor),f'{label} editor not rendered',90)
    try:
        result=check_layout([editor,close])
        if action:
            result['functional']=action()
        screenshot('subject-editor-'+str(list(SUBJECTS).index(subject)+1)+'-'+str(len(results)))
    finally:
        if visible_id(close):
            click(close)
    wait(lambda:not visible_id(editor),f'{label} editor did not close')
    return result


def geometry_editor_action():
    before={i['id'] for i in board_items()}
    click_text('.lektrus-geometry-header-catalog button','2D')
    element=wait(lambda:js('return [...document.querySelectorAll(".lektrus-math-preset-grid button")].find(e=>e.querySelector("strong")?.textContent==="Треугольник")||null;'),'Triangle preset missing')
    command('POST',f'/element/{element[ELEMENT]}/click',{})
    wait(lambda:js('return [...document.querySelectorAll(".lektrus-math-preset-grid button.active")].some(e=>e.querySelector("strong")?.textContent==="Треугольник")||!!document.querySelector(".lektrus-geometry-guided");'),'Triangle preset not selected')
    screenshot('geometry-triangle-preview')
    click('.graph-editor-footer button.primary')
    item=wait(lambda:next((i for i in board_items() if i['id'] not in before and i.get('graphFigureId')=='triangle'),None),'Triangle not persisted',25)
    assert len(item.get('graphPoints',[]))>=3,item
    return {'id':item['id'],'vertices':len(item['graphPoints'])}


def circuit_editor_action():
    before={i['id'] for i in board_items()}
    wait(lambda:visible_id('.lektrus-circuit-parts button') or visible_id('.lektrus-circuit-compact-button'),'Circuit parts unavailable')
    if not visible_id('.lektrus-circuit-parts button'):
        click('.lektrus-circuit-compact-button')
    click('.lektrus-circuit-parts button')
    point=js('''const e=document.querySelector('.lektrus-circuit-canvas-container'),r=e.getBoundingClientRect();
      for(const y of [.45,.55,.35,.65])for(const x of [.5,.4,.6]){
        const p=[Math.round(r.left+r.width*x),Math.round(r.top+r.height*y)],h=document.elementFromPoint(...p);
        if(h&&e.contains(h)&&!h.closest('button,input'))return p;
      }return null;''')
    assert point,'Circuit canvas unavailable for placement'
    native_gesture([tuple(point)])
    wait(lambda:js('return /[1-9]\\d* элементов/.test(document.querySelector(".lektrus-circuit-stage-bottom").textContent)'), 'Touch placement did not add a circuit component')
    screenshot('circuit-component-placed')
    click('.lektrus-circuit-footer button.primary')
    item=wait(lambda:next((i for i in board_items() if i['id'] not in before and i.get('scienceCircuit',{}).get('components')),None),'Circuit not persisted',25)
    return {'id':item['id'],'components':len(item['scienceCircuit']['components'])}


def atlas_zoom():
    # Map geometry is fetched asynchronously. Do not try to click behind
    # the explicit loading/error overlay or claim an offline map is tested.
    try:
        wait(lambda:not visible_id('.lektrus-atlas-overlay'),'Atlas data loading',90)
    except AssertionError:
        failure=js('return document.querySelector(".lektrus-atlas-failure")?.innerText||null')
        if failure:
            assert visible_id('.lektrus-atlas-failure button'),'Atlas retry control missing'
            raise BlockedCheck('Map data unavailable in isolated native environment: '+failure)
        raise BlockedCheck('Atlas data still loading in isolated native environment')
    selector='.lektrus-atlas-zoom-slider input'
    before=js('return Number(document.querySelector(arguments[0]).value)',selector)
    click('.lektrus-atlas-zoom button[title="Увеличить масштаб"]')
    after=wait(lambda: (v if (v:=js('return Number(document.querySelector(arguments[0]).value)',selector))>before else None),'Atlas zoom did not change')
    return {'before':before,'after':after}


def history_year():
    selector='.lektrus-history-period-select'
    before=js('return document.querySelector(arguments[0]).value',selector)
    previous='.lektrus-atlas-timeline button[title="Предыдущий доступный период"]'
    next_period='.lektrus-atlas-timeline button[title="Следующий доступный период"]'
    control=next_period if js('return document.querySelector(arguments[0]).disabled',previous) else previous
    click(control)
    after=wait(lambda: (v if (v:=js('return document.querySelector(arguments[0]).value',selector))!=before else None),'Timeline did not change year',20)
    return {'before':before,'after':after}


def language_drag():
    words=lambda:js('return Array.from(document.querySelectorAll(".lektrus-school-preview [data-sentence-word]")).map(e=>e.dataset.sentenceWord)')
    before=words()
    assert len(before)>=2,'Sentence preview did not render two words'
    points=js('''const w=[...document.querySelectorAll('.lektrus-school-preview [data-sentence-word]')];
      for(let i=0;i<w.length-1;i++){
        const a=w[i].getBoundingClientRect(),b=w[i+1].getBoundingClientRect(),x=Math.round(a.left+a.width/2),y=Math.round(a.top+a.height/2),tx=Math.round(b.right-2),ty=Math.round(b.top+b.height/2);
        if(w[i].contains(document.elementFromPoint(x,y))&&w[i+1].contains(document.elementFromPoint(tx,ty)))return [x,y,tx,ty];
      }return null;''')
    assert points,'No two visible word targets in mobile preview'
    x,y,tx,ty=points
    native_gesture([(round(x+(tx-x)*i/8),round(y+(ty-y)*i/8)) for i in range(9)])
    after=wait(lambda:(v if (v:=words())!=before else None),'Touch drag did not reorder words',10)
    assert sorted(after)==sorted(before),'Word lost during drag'
    return {'before':before,'after':after}


def chemistry_lab():
    choose_subject_tool('Химия','Моделирование опытов')
    wait(lambda:visible_id('.lektrus-lab-open-editor'),'Lab object missing',35)
    click('.lektrus-lab-open-editor')
    wait(lambda:visible_id('.lektrus-lab-editor'),'Fullscreen lab not rendered',45)
    wait(lambda:visible_id('.lektrus-lab-compact-drawer-bar'),'Native phone lab must use compact fullscreen controls',20)
    report=check_layout(['.lektrus-lab-editor','.lektrus-lab-editor-exit'])
    screenshot('chemistry-lab-fullscreen')
    try:
        drawers=('glassware','equipment','indicators','equations','settings','reagents')
        visible_drawers=lambda: [key for key in drawers if visible_id('#lektrus-lab-compact-'+key)]
        assert visible_drawers()==[], 'Closed drawers cover the lab worktop'
        for drawer in drawers:
            click('.lektrus-lab-compact-drawer-bar button[aria-controls="lektrus-lab-compact-'+drawer+'"]')
            wait(lambda:visible_drawers()==[drawer],f'Only {drawer} drawer must be visible',12)
            check_layout(['#lektrus-lab-compact-'+drawer])
        report['exclusiveDrawers']=list(drawers)
        click('.lektrus-lab-editor button[title="Открыть шкаф реактивов"]')
        wait(lambda:visible_id('.lektrus-lab-furniture-dialog.is-reagents'),'Reagent cabinet not opened')
        type_into('.lektrus-lab-furniture-dialog input[type="search"]','HCl')
        hits=wait(lambda:js('return [...document.querySelectorAll(".lektrus-lab-modal-reagents button")].map(e=>e.innerText).filter(e=>e.includes("HCl"))'),'Reagent search did not find hydrochloric acid')
        report['reagents']=hits
        screenshot('chemistry-reagent-search')
    finally:
        if visible_id('.lektrus-lab-modal-head button[aria-label="Закрыть шкаф"]'):
            click('.lektrus-lab-modal-head button[aria-label="Закрыть шкаф"]')
        click('.lektrus-lab-editor-exit')
    wait(lambda:not visible_id('.lektrus-lab-editor'),'Lab exit did not work')
    return report


def create_session():
    common = {'platformName': 'Android' if args.platform=='android' else 'iOS',
              'appium:app': str(Path(args.app).resolve()), 'appium:newCommandTimeout': 180,
              'appium:automationName': 'UiAutomator2' if args.platform=='android' else 'XCUITest'}
    if args.platform=='android':
        # Debug APK intentionally has .dev applicationIdSuffix; the Java
        # namespace/activity remains unchanged. Never launch the release app.
        common.update({'appium:deviceName':'Android Emulator','appium:appPackage':'ru.lektrus.board.dev',
                       'appium:appActivity':'ru.lektrus.board.MainActivity','appium:ensureWebviewsHavePages':True,
                       'appium:autoGrantPermissions':True,'appium:adbExecTimeout':90000})
    else:
        common.update({'appium:udid':args.udid, 'appium:deviceName':'iPhone Simulator',
                       'appium:bundleId':'ru.lektrus.board','appium:wdaLaunchTimeout':180000,
                       'appium:wdaConnectionTimeout':180000, 'appium:showXcodeLog':True,
                       # The CI simulator was explicitly booted via simctl. Opening
                       # Simulator.app makes Appium restart its UI and can time out.
                       'appium:isHeadless':True,'appium:simulatorStartupTimeout':300000,
                       'appium:noReset':True,
                       # iOS 26 simulator reports the host app as process-App
                       # (verified in Web Inspector logs), not its bundle ID.
                       'appium:additionalWebviewBundleIds':['process-App']})
        if args.wda_app:
            common.update({'appium:usePreinstalledWDA':True,'appium:prebuiltWDAPath':args.wda_app})
        elif args.wda_derived_data:
            common.update({'appium:usePrebuiltWDA':True,'appium:derivedDataPath':args.wda_derived_data})
    return request('POST','/session',{'capabilities':{'alwaysMatch':common,'firstMatch':[{}]}}, timeout=900 if args.platform=='ios' else 420)


try:
    wait(lambda: request('GET','/status',timeout=3).get('ready'), 'Appium server unavailable', 90)
    session = create_session()['sessionId']
    print('Native session launched', session, flush=True)
    reattach_webview(150 if args.platform=='ios' else 90)
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
    check('create-board-and-landscape', open_new_board)
    if results[-1]['status']!='passed':
        recover_board_after_create_failure()
    check('board-landscape-bounds', board_layout)
    check('two-finger-pinch', pinch)
    check('pencil-touch', lambda: draw('pen',[.38,.46,.52]), fatal=True)
    check('marker-touch', lambda: draw('marker',[.68,.74,.60]))
    if any(x['kind']=='marker' for x in ink()):
        check('eraser-touch', erase)
    check('undo-redo', undo_redo)
    check('navigation-dock-no-overlap', navigation_dock_layout)
    check('tool-catalogue', tools_menu)
    check('board-reopen-persistence', reopen)
    check('zoom-for-object-tests', zoom_for_objects)
    check('create-rectangle-touch', create_shape)
    if 'shape_id' in paths:
        check('move-object-touch', move_shape)
        check('resize-object-touch', resize_shape)
        check('rotate-duplicate-delete', shape_actions)
    check('text-native-keyboard',lambda:text_object('text','Текст','Текст QA'))
    check('sticky-native-keyboard',lambda:text_object('sticky','Стикер','Заметка QA'))
    check('table-edit-and-save',table_editor)
    check('all-objects-reopen-persistence',full_document_persistence)
    check('checklist-edit-and-save',checklist_editor)
    check('flashcard-edit-and-save',flashcard_editor)
    check('quiz-edit-and-save',quiz_editor)
    check('formula-edit-and-save',formula_editor)
    for i,subject in enumerate(SUBJECTS):
        check('subject-catalogue-'+str(i+1),lambda:subject_catalogue(subject))
    check('subject-math-geometry-editor',lambda:subject_editor('Математика','Построение фигур','.graph-editor-modal','button[aria-label="Закрыть редактор без сохранения"]',geometry_editor_action))
    check('subject-physics-circuit-editor',lambda:subject_editor('Физика','Электрические цепи','.lektrus-circuit-editor','.lektrus-circuit-close',circuit_editor_action))
    check('subject-geography-atlas-editor',lambda:subject_editor('География','Географические карты','.lektrus-school-editor','.lektrus-school-close',atlas_zoom))
    check('subject-history-atlas-editor',lambda:subject_editor('История','Исторические карты','.lektrus-school-editor','.lektrus-school-close',history_year))
    check('subject-language-sentence-editor',lambda:subject_editor('Иностранный язык','Составление предложений','.lektrus-school-editor','.lektrus-school-close',language_drag))
    # Native activity transitions can invalidate the automation driver even
    # when the installed app still runs. Keep them after independent editor
    # coverage so a lost transport cannot mask another 27 product checks.
    check('native-file-export-save',native_file_export_save)
    check('native-file-export-cancel',native_file_export_cancel)
    check('subject-chemistry-lab-fullscreen',chemistry_lab)
    check('native-back-and-deep-link', native_back_and_link)
except Exception as error:
    print(traceback.format_exc(), file=sys.stderr, flush=True)
    runtime_abort=str(error)
    if session:
        try:
            screenshot('runtime-aborted')
        except Exception:
            pass
finally:
    seen={r['check'] for r in results}
    for name in EXPECTED_CHECKS:
        if name not in seen:
            results.append({'check':name,'status':'blocked','detail':'Prior prerequisite failed or runtime aborted'})
    summary={'planned':len(EXPECTED_CHECKS),**{s:sum(r['status']==s for r in results) for s in ('passed','failed','blocked')}}
    evidence_summary={s:sum(r['status']==s for r in screenshot_evidence) for s in ('captured','missing')}
    (args.output/'report.json').write_text(json.dumps({'platform': args.platform, 'summary':summary,'runtime_abort':runtime_abort,'results':results,'screenshot_summary':evidence_summary,'screenshot_evidence':screenshot_evidence}, ensure_ascii=False, indent=2))
    if session:
        try:
            command('DELETE','')
        except Exception:
            pass
    print('QA SUMMARY: '+json.dumps(summary),flush=True)
    print('QA SCREENSHOTS: '+json.dumps(evidence_summary),flush=True)
    print(json.dumps(results, ensure_ascii=False), flush=True)

sys.exit(0 if runtime_abort is None and len(results)==len(EXPECTED_CHECKS) and all(r['status']=='passed' for r in results) and not evidence_summary['missing'] else 1)
