"""Real-browser acceptance against disposable Lektrus API/Postgres, not DOM mocks."""
import asyncio
import json
from functools import lru_cache
import os
import sys
import struct
import time
import zlib
import re
from pathlib import Path
from uuid import uuid4
import asyncpg
import bcrypt
import httpx
from playwright.sync_api import sync_playwright, expect

BASE=os.getenv("LEKTRUS_QA_BASE","http://127.0.0.1:5173")
API=os.getenv("LEKTRUS_QA_API","http://127.0.0.1:8000")
PASSWORD="Roles-test-password-123"
OUT=Path("artifacts/participant-roles"); OUT.mkdir(parents=True,exist_ok=True)

async def seed():
    conn=await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        hashed=bcrypt.hashpw(PASSWORD.encode(),bcrypt.gensalt(rounds=4)).decode()
        for name,role in [("owner","teacher"),("learner","student"),("colleague","teacher"),("observer","student")]:
            await conn.execute("""INSERT INTO account_users(id,email,password_hash,display_name,account_role,teacher_status,email_confirmed_at)
                VALUES($1,$2,$3,$4,$5,$6,now())""",uuid4(),name+"@roles.example",hashed,name,role,"approved" if role=="teacher" else "none")
    finally:
        await conn.close()

# These API-only sessions are independent of the real browser logins.
# Reuse them throughout the suite instead of consuming the login rate limit.
@lru_cache(maxsize=4)
def headers(name):
    with httpx.Client(base_url=API) as client:
        response=client.post("/api/v1/auth/login",json={"email":name+"@roles.example","password":PASSWORD})
        response.raise_for_status()
        return {"Authorization":"Bearer "+response.json()["access_token"]}

def setup_board():
    with httpx.Client(base_url=API,headers=headers("owner")) as client:
        board=client.post("/api/v1/boards",json={"title":"Participant roles QA"}); board.raise_for_status()
        ident=board.json()["id"]
        for name,kind,role in [("learner","student","editor"),("colleague","co_teacher","editor"),("observer","observer","viewer")]:
            r=client.post(f"/api/v1/boards/{ident}/invitations",json={"email":name+"@roles.example","role":role,"participant_role":kind});r.raise_for_status()
        doc={"version":1,"title":"Participant roles QA","view":{"x":0,"y":0,"zoom":1},"items":[]}
        client.put(f"/api/v1/boards/{ident}/document",json={"expected_version":0,"document":doc}).raise_for_status()
        return ident

def login(page,name):
    page.goto(BASE+"/app")
    page.get_by_label("Email",exact=True).fill(name+"@roles.example")
    page.get_by_label("Пароль",exact=True).fill(PASSWORD)
    page.get_by_role("button",name="Войти",exact=True).click()
    expect(page.get_by_role("button",name="Я учусь",exact=True)).to_be_visible(timeout=60000)

def check_board_read_recovery(page, ident):
    board_path = BASE + "/board/" + ident
    metadata = re.compile(re.escape(API + "/api/v1/boards/" + ident) + r"(?:\?.*)?$")
    document = re.compile(re.escape(API + "/api/v1/boards/" + ident + "/document") + r"(?:\?.*)?$")

    # An interrupted initial GET may recover automatically. Only reads are retried.
    first = []
    def transient(route):
        if route.request.method != "GET":
            route.continue_(); return
        first.append(route.request.url)
        if len(first)==1: route.abort("failed")
        else: route.continue_()
    page.route(metadata, transient)
    page.goto(board_path)
    expect(page.locator("section.board")).to_be_visible(timeout=90000)
    assert len(first)>=2, first
    page.unroute(metadata, transient)

    # Both stages can fail before the lazy board bundle loads. The error card
    # must be styled, localized and retry without losing the exact deep link.
    for phase, pattern in [("metadata",metadata),("document",document)]:
        attempts = []
        def blocked(route):
            if route.request.method == "GET":
                attempts.append(route.request.url)
                route.abort("failed")
            else: route.continue_()
        page.route(pattern, blocked)
        page.goto(board_path)
        card=page.get_by_role("alertdialog",name="Не удалось открыть доску")
        expect(card).to_be_visible(timeout=45000)
        expect(card).to_contain_text("Не удалось связаться с сервером Lektrus")
        expect(card).not_to_contain_text("Failed to fetch")
        assert len(attempts)==2, (phase,attempts)
        for width,height in [(1440,900),(320,640)]:
            page.set_viewport_size({"width":width,"height":height})
            geometry=page.evaluate("""() => {
              const overlay=document.querySelector('.board-recovery-overlay'), card=document.querySelector('.board-recovery-card'),r=card.getBoundingClientRect();
              return {position:getComputedStyle(overlay).position,display:getComputedStyle(card).display,left:r.left,right:r.right,top:r.top,bottom:r.bottom,viewport:[innerWidth,innerHeight],buttons:[...card.querySelectorAll('button')].map(x=>x.getBoundingClientRect().height)};
            }""")
            assert geometry["position"]=="fixed" and geometry["display"]=="grid", geometry
            assert 0<=geometry["left"]<geometry["right"]<=width+1 and 0<=geometry["top"]<geometry["bottom"]<=height+1, geometry
            assert all(h>=43 for h in geometry["buttons"]), geometry
            page.screenshot(path=str(OUT/f"board-recovery-{phase}-{width}.png"))
        page.set_viewport_size({"width":1440,"height":900})
        page.unroute(pattern,blocked)
        card.get_by_role("button",name="Повторить").click()
        expect(page.locator("section.board")).to_be_visible(timeout=90000)
        assert page.url==board_path, page.url

    # A revoked/expired session is different from a network error. A user can
    # authenticate again without the board link disappearing from the address bar.
    def unauthorized(route):
        if route.request.method=="GET":
            route.fulfill(status=401,headers={"Access-Control-Allow-Origin":BASE,"Content-Type":"application/json"},body='{"detail":"expired session"}')
        else: route.continue_()
    page.route(metadata,unauthorized)
    page.goto(board_path)
    card=page.get_by_role("alertdialog",name="Не удалось открыть доску")
    expect(card).to_contain_text("Сессия завершена",timeout=45000)
    page.unroute(metadata,unauthorized)
    card.get_by_role("button",name="Войти заново").click()
    page.get_by_label("Email",exact=True).fill("owner@roles.example")
    page.get_by_label("Пароль",exact=True).fill(PASSWORD)
    page.get_by_role("button",name="Войти",exact=True).click()
    expect(page.locator("section.board")).to_be_visible(timeout=90000)
    assert page.url==board_path, page.url

    print("Board network recovery: automatic GET retry, metadata/document failure with styled card, manual retry and reauthentication passed")

def assert_compact_workspace(page, name, width, height):
    page.set_viewport_size({"width":width,"height":height})
    page.goto(BASE+"/app")
    expect(page.locator(".lectris-mode-segment")).to_be_visible(timeout=60000)
    expect(page.locator(".lectris-mode-option[aria-pressed=true]")).to_have_count(1)
    geometry=page.evaluate("""() => {
      const box = s => { const n=document.querySelector(s), r=n.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,width:r.width} };
      const stage=document.querySelector('.lectris-workspace-stage');
      return {viewport:innerWidth, doc:document.documentElement.scrollWidth,
        stage:box('.lectris-workspace-stage'), mode:box('.lectris-mode-segment'),
        header:box('.lectris-workspace-header'), dock:box('.lectris-mobile-bottom'),
        buttons:[...document.querySelectorAll('.lectris-mode-option')].map(n=>({height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width})),
        padding:parseFloat(getComputedStyle(stage).paddingBottom)};
    }""")
    assert geometry["doc"]<=width+2, (name, width, geometry)
    assert geometry["mode"]["x"]>=geometry["stage"]["x"]-1 and geometry["mode"]["right"]<=geometry["stage"]["right"]+1, geometry
    assert all(b["height"]>=40 and b["width"]>=100 for b in geometry["buttons"]), geometry
    if width<=700:
        assert geometry["stage"]["y"]>=geometry["header"]["bottom"]-2, geometry
        assert geometry["stage"]["bottom"]<=geometry["dock"]["y"]+2, geometry
        assert geometry["padding"]<=16, geometry
    page.screenshot(path=str(OUT/f"{name}-home-{width}x{height}.png"))

    # The mode switch belongs exclusively to Home, never the board library,
    # profile or settings. Navigate to the real sections before testing them.
    page.goto(BASE+"/app?section=profile")
    expect(page.get_by_role("heading",name="Личные данные",exact=True)).to_be_visible(timeout=60000)
    expect(page.locator(".lectris-mode-segment")).to_have_count(0)
    expect(page.locator(".profile-section-heading").get_by_text("01",exact=True)).to_have_count(0)
    page.goto(BASE+"/app?section=settings")
    expect(page.locator(".settings-compact-content")).to_be_visible(timeout=60000)
    expect(page.locator(".lectris-mode-segment")).to_have_count(0)
    page.goto(BASE+"/app?section=boards")
    expect(page.get_by_role("heading",name="Все доски",exact=True)).to_be_visible(timeout=60000)
    expect(page.locator(".lectris-mode-segment")).to_have_count(0)
    if width<=700:
        toggle=page.get_by_role("button", name="Управление досками")
        expect(toggle).to_have_attribute("aria-expanded", "false")
        expect(page.locator("#library-board-actions")).to_be_hidden()
        toggle.click()
        expect(page.locator("#library-board-actions")).to_be_visible()
        toggle.click()
        expect(page.locator("#library-board-actions")).to_be_hidden()
        page.locator(".lectris-workspace-stage").evaluate("node=>node.scrollTop=0")
        expect(page.locator(".lectris-library-card").first).to_be_visible(timeout=30000)
        gallery=page.evaluate("""() => {
          const preview=document.querySelector('.lectris-library-card .lectris-library-preview').getBoundingClientRect();
          const dock=document.querySelector('.lectris-mobile-bottom').getBoundingClientRect();
          const sort=document.querySelector('.lectris-library-sort select').getBoundingClientRect();
          const actions=document.querySelector('.lectris-library-actions-toggle').getBoundingClientRect();
          const card=document.querySelector('.lectris-library-card').getBoundingClientRect();
          const title=document.querySelector('.lectris-library-card .board-card-title').getBoundingClientRect();
          return {previewTop:preview.top,previewRight:preview.right,dockTop:dock.top,cardWidth:card.width,titleLeft:title.left,titleBottom:title.bottom,sort:[sort.left,sort.right,sort.top,sort.height],actions:[actions.left,actions.right,actions.top,actions.height]};
        }""")
        assert gallery["previewTop"]+50<gallery["dockTop"], (name,width,gallery)
        assert gallery["sort"][1]<=gallery["actions"][0] and abs(gallery["sort"][2]-gallery["actions"][2])<3, gallery
        assert gallery["sort"][3]>=39 and gallery["actions"][3]>=39, gallery
        assert abs((gallery["sort"][1]-gallery["sort"][0])-(gallery["actions"][1]-gallery["actions"][0]))<3, gallery
        assert gallery["cardWidth"]>=width-30 and gallery["titleLeft"]>gallery["previewRight"] and gallery["titleBottom"]<gallery["dockTop"], gallery
        expected_role={"owner":"Владелец","learner":"Ученик","colleague":"Сопреподаватель","observer":"Наблюдатель"}[name]
        expect(page.locator(".lectris-library-card .lectris-library-preview-label").first).to_have_text(expected_role)
        expect(page.locator(".lectris-library-card .board-card-meta").first).not_to_contain_text("Редактор")
        expect(page.locator(".lectris-library-card .board-card-meta").first).not_to_contain_text("Просмотр")
        expect(page.locator(".lectris-library-create-tile")).to_be_hidden()
    page.screenshot(path=str(OUT/f"{name}-compact-{width}x{height}.png"))

def assert_board(page,ident,can_author,owner,*,navigate=True,embedded=False):
    if navigate:
        page.goto(BASE+"/board/"+ident)
    # Touch browsers intentionally mount the board in a landscape iframe.
    # Inspect its real controls and canvas, not the empty parent document.
    scope=page.frame_locator("iframe.lektrus-browser-board-frame") if embedded else page
    expect(scope.locator("section.board")).to_be_visible(timeout=90000)
    subject=scope.locator('button[aria-label="Предметные инструменты"]:visible')
    if can_author:
        expect(subject.first).to_be_visible(timeout=15000)
    else:
        expect(subject).to_have_count(0)
    share=scope.locator('button[aria-label="Добавить участника"]:visible')
    if owner:
        expect(share.first).to_be_visible()
    else:
        expect(share).to_have_count(0)
    return scope

def assert_role_toolbar(scope, editable, teacher, touch=False):
    if not editable:
        expect(scope.locator(".compact-toolbar,.mobile-board-tools")).to_have_count(0)
        return
    rail=scope.locator("nav.mobile-board-tools" if touch else ".toolbar.compact-toolbar")
    expect(rail).to_be_visible()
    for tool in ("select","lasso","pen","marker","eraser"):
        # Pinned tools may be scrollable in a short landscape viewport.
        expect(rail.locator(f'[data-interface-control="{tool}"]')).to_have_count(1)
    if touch:
        expect(rail.locator('[data-lektrus-hand-tool="true"]')).to_have_count(1)
    for tool in ("frame","table","graph","formula","quiz","checklist"):
        if not teacher:
            expect(rail.locator(f'[data-interface-control="{tool}"]')).to_have_count(0)
    expect(scope.locator('button[aria-label="Предметные инструменты"]:visible')).to_have_count(1 if teacher else 0)


def seed_legacy_empty_toolbar(page):
    page.evaluate("""() => {
      const session=JSON.parse(localStorage.getItem('lektrus.selfhost.session.v1'));
      for(const role of ['teacher','student'])for(const device of ['desktop','touch']){
        localStorage.setItem('lectris.toolbar.v2.'+session.user.id+'.'+role+'.'+device,'[]');
        localStorage.setItem('lectris.named-layouts.v1.'+session.user.id+'.'+role+'.'+device,JSON.stringify([{id:'qa-layout',name:'QA saved layout',mode:'standard',pinned:['pen','marker','eraser']}]));
      }
    }""")


def assert_viewer_mode(scope):
    expect(scope.locator("section.board.board-tool-hand")).to_be_visible()
    expect(scope.locator(".compact-toolbar,.mobile-board-tools,.mobile-tools-sheet,.mobile-undo-redo,.welcome-actions")).to_have_count(0)
    expect(scope.locator(".viewer-banner,.student-board-mode")).to_have_count(0)
    status=scope.locator(".topbar .board-access-status")
    expect(status).to_be_visible()
    expect(status).to_have_attribute("aria-label","Только просмотр")
    assert status.evaluate("""el => {
        const r=el.getBoundingClientRect(), header=el.closest('.topbar').getBoundingClientRect();
        const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return r.top>=header.top-1 && r.bottom<=header.bottom+1 && el.contains(hit);
    }"""), "View-only status must not overlap the header"


def assert_history_controls(scope,editable):
    history=scope.locator(".mobile-undo-redo")
    if not editable:
        expect(history).to_have_count(0)
        return
    expect(history).to_be_visible()
    for label in ("Отменить","Повторить"):
        button=history.get_by_role("button",name=label,exact=True)
        expect(button).to_be_visible()
        assert button.evaluate("""el => {
            const r=el.getBoundingClientRect();
            const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            return r.width>0 && r.height>0 && el.contains(hit);
        }"""), f"{label} is covered by another control"


def assert_drawing_saved(page,ident,name):
    history=page.locator(".mobile-undo-redo")
    undo=history.get_by_role("button",name="Отменить",exact=True)
    redo=history.get_by_role("button",name="Повторить",exact=True)
    expect(undo).to_be_disabled()
    expect(redo).to_be_disabled()
    pen=page.locator('[data-interface-control="pen"]:visible').first
    expect(pen).to_be_visible()
    pen.click()
    box=page.locator("section.board").bounding_box()
    x=box["x"]+box["width"]*0.72
    y=box["y"]+box["height"]*0.60
    page.mouse.move(x,y)
    page.mouse.down()
    page.mouse.move(x+96,y+32,steps=12)
    page.mouse.up()
    with httpx.Client(base_url=API,headers=headers(name)) as client:
        for _ in range(60):
            result=client.get(f"/api/v1/boards/{ident}/document")
            result.raise_for_status()
            saved=result.json()
            doc=saved["document"]
            items=doc["items"]+[entry["stroke"] for entry in doc.get("ink",[])]
            stroke=next((item for item in items if item.get("kind")=="pen" and item.get("createdBy")==saved["updated_by"]),None)
            if stroke:
                break
            page.wait_for_timeout(500)
        else:
            raise AssertionError("Learner drawing did not persist to the real API")
        stroke_id=stroke["id"]
        other_ids={item["id"] for item in items if item["id"]!=stroke_id}
        def expect_saved(visible):
            for _ in range(60):
                result=client.get(f"/api/v1/boards/{ident}/document")
                result.raise_for_status()
                doc=result.json()["document"]
                ids={item["id"] for item in doc["items"]+[entry["stroke"] for entry in doc.get("ink",[])]}
                if (stroke_id in ids)==visible:
                    assert other_ids<=ids, "Personal history removed another participant's work"
                    return
                page.wait_for_timeout(500)
            raise AssertionError("Personal undo/redo did not persist")
        expect(undo).to_be_enabled()
        undo.click()
        expect(redo).to_be_enabled()
        expect_saved(False)
        redo.click()
        expect(undo).to_be_enabled()
        expect_saved(True)

def check_shared_eraser_sync(browser):
    # Two real sessions, real PostgreSQL. A visible stroke is already durable
    # even before pointer-up; a delayed extension may never resurrect erased ink.
    ident=setup_board()
    url=f"/api/v1/boards/{ident}/document"
    pattern=re.compile(re.escape(API+url)+r"(?:\?.*)?$")
    contexts=[browser.new_context(viewport={"width":1440,"height":900},service_workers="block") for _ in range(2)]
    teacher,pupil=[ctx.new_page() for ctx in contexts]
    # Intercept the actual durable websocket path as well as legacy HTTP.
    # Never simulate loss by disabling the new protocol under test.
    controls={page:{"hold":None,"hold_all":False,"held":[],"commits":[],"motion":[],"revisions":[],"impair":False,"delayed":[],"dropped":0,"motion_seen":0,"revision_seen":0} for page in (teacher,pupil)}
    for page,control in controls.items():
        def route_ws(route,control=control):
            upstream=route.connect_to_server()
            def outgoing(message):
                frame=json.loads(message)
                if frame.get("type")=="ink_motion":
                    control["motion"].append(frame)
                if frame.get("type")=="ink_commit":
                    control["commits"].append(frame)
                    if control["hold_all"]:
                        control["held"].append((upstream,message));return
                    changes=frame.get("delta",{}).get("items",{})
                    if control["hold"] and any(i.get("id")==control["hold"] for i in changes.get("upsert",[])+changes.get("point_edits",[])):
                        control["held"].append((upstream,message));return
                upstream.send(message)
            def incoming(message):
                event=json.loads(message)
                if event.get("type")=="document_changed":control["revisions"].append(event["version"])
                if control["impair"] and event.get("type") in ("ink_motion","document_changed"):
                    key="motion_seen" if event["type"]=="ink_motion" else "revision_seen"
                    control[key]+=1
                    # Discard a deterministic subset of live frames and
                    # revision notices, delay the rest by 120 ms. Never
                    # discard authoritative commit acknowledgements.
                    divisor=5 if key=="motion_seen" else 4
                    if control[key]%divisor==0:
                        control["dropped"]+=1;return
                    control["delayed"].append((time.monotonic()+.12,route,message));return
                route.send(message)
            route.on_message(outgoing)
            upstream.on_message(incoming)
        page.route_web_socket(re.compile(r"/api/v1/boards/[^/]+/events"),route_ws)
    try:
        login(teacher,"owner")
        login(pupil,"learner")
        assert_board(teacher,ident,True,True)
        assert_board(pupil,ident,False,False)
        # Real peer geometry is checked while the pointer is still down.
        # Use the existing sessions rather than a mock WebSocket or source regex.
        with httpx.Client(base_url=API,headers=headers("owner")) as api:
            base=api.get(url).json()
            doc=base["document"]
            doc["items"]=[
                {"id":"live-qa-shape","kind":"shape","shapeType":"rectangle","x":220,"y":180,"width":140,"height":100,"text":"","color":"#5355c9"},
                {"id":"live-qa-text","kind":"text","x":460,"y":180,"width":240,"height":90,"text":"Before live typing","color":"#202124"},
                {"id":"live-qa-ruler","kind":"instrument","instrumentType":"ruler","instrumentScale":0.55,"x":440,"y":420,"width":410,"height":88,"text":"","rotation":0},
            ]
            api.put(url,json={"expected_version":base["version"],"document":doc}).raise_for_status()
        shape='.board-object[data-object="live-qa-shape"]'
        words='.board-object[data-object="live-qa-text"]'
        ruler='[data-shared-instrument="live-qa-ruler"] .geometry-instrument-body'
        for page in (teacher,pupil):
            expect(page.locator(shape)).to_be_visible(timeout=20000)
            expect(page.locator(words)).to_be_visible(timeout=20000)
            expect(page.locator(ruler)).to_be_visible(timeout=20000)
        teacher.locator('[data-interface-control="select"]:visible').first.click()
        pupil.locator('[data-interface-control="select"]:visible').first.click()
        def live_drag(sender,receiver,selector):
            target=sender.locator(selector).bounding_box()
            before=receiver.locator(selector).bounding_box()
            x=target["x"]+target["width"]*.5
            y=target["y"]+target["height"]*.5
            sender.mouse.move(x,y)
            sender.mouse.down()
            try:
                sender.mouse.move(x+90,y+36,steps=10)
                receiver.wait_for_function("""({selector,x,y})=>{
                    const el=document.querySelector(selector);if(!el)return false;
                    const r=el.getBoundingClientRect();
                    return Math.hypot(r.x-x,r.y-y)>25;
                }""",arg={"selector":selector,"x":before["x"],"y":before["y"]},timeout=5000)
            finally:
                sender.mouse.up()
            sender.wait_for_timeout(350)
        live_drag(teacher,pupil,shape)
        same=contexts[0].new_page()
        try:
            assert_board(same,ident,True,True)
            expect(same.locator(shape)).to_be_visible(timeout=20000)
            live_drag(teacher,same,shape)
        finally:
            same.close()
        live_drag(teacher,pupil,ruler)
        # A peer revision arrives DURING a real object drag. On release the
        # pupil must save against that revision, not provoke an avoidable 409.
        pupil.locator('[data-interface-control="select"]:visible').first.click()
        commit_start=len(controls[pupil]["commits"])
        http_writes=[]
        def record_write(route):
            if route.request.method in ("PUT","PATCH"):
                http_writes.append(route.request.post_data_json["expected_version"])
            route.continue_()
        pupil.route(pattern,record_write)
        with httpx.Client(base_url=API,headers=headers("owner")) as api:
            row=api.get(url).json()
            old=next(i for i in row["document"]["items"] if i["id"]=="live-qa-shape")
            target=pupil.locator(shape).bounding_box()
            x=target["x"]+target["width"]/2;y=target["y"]+target["height"]/2
            pupil.mouse.move(x,y);pupil.mouse.down()
            try:
                pupil.mouse.move(x+65,y+22,steps=9)
                added={"id":"live-qa-during-drag","kind":"text","x":40,"y":30,"width":120,"height":50,"text":"Peer revision"}
                response=api.patch(url,json={"expected_version":row["version"],"delta":{"items":{"upsert":[added]}}})
                response.raise_for_status();peer_version=response.json()["version"]
                for _ in range(60):
                    if peer_version in controls[pupil]["revisions"]:break
                    pupil.wait_for_timeout(100)
                assert peer_version in controls[pupil]["revisions"],"Peer revision did not reach the held drag"
                pupil.wait_for_timeout(250)
            finally:pupil.mouse.up()
            for _ in range(100):
                current=api.get(url).json()["document"]["items"]
                moved=next(i for i in current if i["id"]==old["id"])
                if abs(moved["x"]-old["x"])>25 and any(i["id"]==added["id"] for i in current):break
                pupil.wait_for_timeout(100)
            else:raise AssertionError("Drag and independent peer insertion failed to converge")
            versions=http_writes+[f["expected_version"] for f in controls[pupil]["commits"][commit_start:]]
            assert versions and min(versions)>=peer_version,("Stale write after deferred revision",versions,peer_version)
        pupil.unroute(pattern,record_write)
        print("Held object drag reconciled peer revision before first durable write.")
        teacher.locator(words).dblclick()
        field=teacher.locator(words+" textarea")
        expect(field).to_be_visible()
        field.fill("Peer sees typing before blur")
        expect(pupil.locator(words)).to_contain_text("Peer sees typing before blur",timeout=5000)
        assert field.evaluate("el=>document.activeElement===el"),"Text test must keep editing active"
        field.press("Tab")
        teacher.wait_for_timeout(750)
        with httpx.Client(base_url=API,headers=headers("owner")) as api:
            base=api.get(url).json()
            doc=base["document"]
            doc["items"]=[i for i in doc["items"] if not i["id"].startswith("live-qa-")]
            api.put(url,json={"expected_version":base["version"],"document":doc}).raise_for_status()
        for page in (teacher,pupil):
            expect(page.locator(shape)).to_have_count(0,timeout=20000)
        print("Live object motion across accounts and tabs, measuring instrument and text before pointer-up/blur verified against real peer.")
        # Create and delete real UI objects in BOTH directions. A seeded server
        # object alone cannot catch student-side serialization/author bugs.
        with httpx.Client(base_url=API,headers=headers("owner")) as api:
            for sender,receiver in ((pupil,teacher),(teacher,pupil)):
                for shortcut,kind in (("t","text"),("r","shape"),("s","sticky")):
                    before={i["id"] for i in api.get(url).json()["document"]["items"]}
                    sender.locator('[data-interface-control="select"]:visible').first.click()
                    sender.keyboard.press(shortcut)
                    if kind=="shape":
                        sender.locator('.lektrus-figures-floating button[title="Прямоугольник"]').click()
                    expect(sender.locator("section.board")).to_have_class(re.compile(r"\bboard-tool-"+kind+r"\b"))
                    box=sender.locator("section.board").bounding_box()
                    sender.mouse.click(box["x"]+box["width"]*.70,box["y"]+box["height"]*.55)
                    if kind=="text":
                        field=sender.locator('textarea[aria-label="Текст объекта"]')
                        expect(field).to_be_visible(timeout=5000)
                        field.fill("Two-way object sync")
                        field.press("Tab")
                    added=None
                    for _ in range(60):
                        row=api.get(url).json()
                        added=next((i for i in row["document"]["items"] if i["id"] not in before and i["kind"]==kind),None)
                        if added: break
                        sender.wait_for_timeout(100)
                    assert added, (kind,"created locally but not committed")
                    selector=f'.board-object[data-object="{added["id"]}"]'
                    expect(receiver.locator(selector)).to_be_visible(timeout=7000)
                    sender.locator('[data-interface-control="select"]:visible').first.click()
                    sender.locator(selector).click()
                    sender.keyboard.press("Delete")
                    expect(receiver.locator(selector)).to_have_count(0,timeout=7000)
                    assert all(i["id"]!=added["id"] for i in api.get(url).json()["document"]["items"])
        print("Teacher and student UI creation/deletion of text, shape and sticky converged.")
        with httpx.Client(base_url=API,headers=headers("owner")) as client:
            def read():
                response=client.get(url)
                response.raise_for_status()
                return response.json()
            def inks(row):
                doc=row["document"]
                return [item for item in doc["items"]+[entry["stroke"] for entry in doc.get("ink",[])] if item["kind"] in ("pen","marker")]
            def wait_row(page, condition, message):
                for _ in range(120):
                    row=read()
                    if condition(row):
                        return row
                    page.wait_for_timeout(100)
                raise AssertionError(f"{message}: {row}")
            def stored(page, stroke_id, present=True):
                page.wait_for_function("""({id,ident,present})=>{
                    const raw=localStorage.getItem('lesson-board.document.v1.board.'+ident);
                    if(!raw)return false;
                    const doc=JSON.parse(raw);
                    return doc.items.some(i=>i.id===id)===present;
                }""",arg={"id":stroke_id,"ident":ident,"present":present},timeout=20000)
            # Hold all actual durable writes while the peer receives fast item
            # updates. Verify real pixels, not just WebSocket packet counts.
            def ink_pixels(page,points):
                return page.evaluate("""points=>{
                    const world=document.querySelector('.world');
                    const r=world.getBoundingClientRect(),s=new DOMMatrix(getComputedStyle(world).transform).a;
                    const canvases=[...document.querySelectorAll('.viewer-ink-canvas')];
                    return points.map(p=>canvases.some(canvas=>{
                      const b=canvas.getBoundingClientRect(),x=r.left+p.x*s,y=r.top+p.y*s;
                      if(x<b.left||x>b.right||y<b.top||y>b.bottom||!canvas.width||!canvas.height)return false;
                      const px=Math.max(0,Math.min(canvas.width-1,Math.round((x-b.left)*canvas.width/b.width)));
                      const py=Math.max(0,Math.min(canvas.height-1,Math.round((y-b.top)*canvas.height/b.height)));
                      const sx=Math.max(0,px-2),sy=Math.max(0,py-2);
                      return canvas.getContext('2d').getImageData(sx,sy,Math.min(5,canvas.width-sx),Math.min(5,canvas.height-sy)).data.some((v,i)=>i%4===3&&v>25);
                    }));
                }""",points)
            held_http=[]
            observed_pixel_ms=[]
            def hold_durable_http(route):
                if route.request.method in ("PUT","PATCH"):held_http.append(route)
                else:route.continue_()
            def release_writes(page,control):
                control["hold_all"]=False
                for upstream,message in control["held"]:upstream.send(message)
                control["held"].clear()
                for route in held_http:route.continue_()
                held_http.clear()
                page.unroute(pattern,hold_durable_http)
            for writer,eraser,mode,kind in ((teacher,pupil,"stroke","pen"),(pupil,teacher,"partial","marker")):
                writer.locator(f'[data-interface-control="{kind}"]:visible').first.click()
                eraser.locator('[data-interface-control="eraser"]:visible').first.click()
                eraser.locator(f'[data-eraser-mode="{mode}"]:visible').first.click()
                original={i["id"] for i in inks(read())}
                control=controls[writer]
                control["motion"].clear();control["hold_all"]=True
                writer.route(pattern,hold_durable_http)
                box=writer.locator("section.board").bounding_box()
                x,y=box["x"]+box["width"]*.40,box["y"]+box["height"]*.26
                try:
                    writer.mouse.move(x,y);writer.mouse.down()
                    writer.mouse.move(x+140,y,steps=14)
                    observed_start=time.monotonic()
                    for _ in range(60):
                        writer.wait_for_timeout(25)
                        if control["motion"] and (control["held"] or held_http):
                            frame=control["motion"][-1]
                            if ink_pixels(eraser,[{"x":frame["x"],"y":frame["y"]}])==[True]:break
                    else:raise AssertionError("Peer pixels absent while all durable writes are blocked")
                    observed_pixel_ms.append((kind+" initial",round((time.monotonic()-observed_start)*1000,1)))
                    assert {i["id"] for i in inks(read())}==original
                    first=control["motion"][-1]
                    writer.mouse.move(x+220,y,steps=10)
                    observed_start=time.monotonic()
                    for _ in range(60):
                        writer.wait_for_timeout(25)
                        frame=control["motion"][-1]
                        if frame["seq"]>first["seq"] and ink_pixels(eraser,[{"x":frame["x"],"y":frame["y"]}])==[True]:break
                    else:raise AssertionError("Growing stroke stopped while database ACK was blocked")
                    observed_pixel_ms.append((kind+" extension",round((time.monotonic()-observed_start)*1000,1)))
                    assert eraser.locator(".remote-live-ink-layer").count()==0
                    writer.mouse.up()
                finally:
                    release_writes(writer,control)
                saved=wait_row(writer,lambda r:any(i["id"] not in original and i.get("width",0)>180 for i in inks(r)),"Fast stroke was not persisted")
                new_ink=[i for i in inks(saved) if i["id"] not in original]
                assert len(new_ink)==1,"Fast drawing must create exactly one permanent ID"
                stroke=new_ink[0]
                stored(eraser,stroke["id"])
                # Wait until the final saved stroke is visible in both clients.
                writer.wait_for_timeout(300)
                center={"x":stroke["x"]+stroke["width"]/2,"y":stroke["y"]+stroke["height"]/2}
                target=eraser.evaluate("""p=>{
                    const w=document.querySelector('.world'),r=w.getBoundingClientRect(),s=new DOMMatrix(getComputedStyle(w).transform).a;
                    return {x:r.left+p.x*s,y:r.top+p.y*s};
                }""",center)
                control=controls[eraser];control["motion"].clear();control["hold_all"]=True
                eraser.route(pattern,hold_durable_http)
                try:
                    assert ink_pixels(writer,[center])==[True]
                    eraser.mouse.move(target["x"],target["y"]);eraser.mouse.down()
                    observed_start=time.monotonic()
                    for _ in range(60):
                        eraser.wait_for_timeout(25)
                        if control["motion"] and (control["held"] or held_http) and ink_pixels(writer,[center])==[False]:break
                    else:raise AssertionError(f"Peer {mode} eraser did not clear pixels before its database ACK")
                    observed_pixel_ms.append((mode+" erase",round((time.monotonic()-observed_start)*1000,1)))
                    assert any(i["id"]==stroke["id"] for i in inks(read()))
                    eraser.mouse.up()
                finally:
                    release_writes(eraser,control)
                final=wait_row(eraser,lambda r:all(i["id"]!=stroke["id"] for i in inks(r)),"Fast erase was not persisted")
                stored(writer,stroke["id"],False)
                assert len(inks(final))==len(original)+(0 if mode=="stroke" else 2)
                if mode=="partial":
                    # Remove the two test fragments so existing race tests
                    # begin with the exact same clean document.
                    latest=read()
                    doc=latest["document"]
                    doc["items"]=[i for i in doc["items"] if i["kind"] not in ("pen","marker") or i["id"] in original]
                    client.put(url,json={"expected_version":latest["version"],"document":doc}).raise_for_status()
                    for item in inks(final):
                        if item["id"] not in original:
                            for page in (writer,eraser):stored(page,item["id"],False)
                print(f"Fast {kind} and {mode} eraser rendered actual pixels while all durable writes were blocked.")
            print("Post-input to observed peer pixels (ms; includes polling, excludes mouse dispatch):",json.dumps(observed_pixel_ms))
            for writer,eraser,mode,kind in ((pupil,teacher,"stroke","pen"),(teacher,pupil,"partial","marker")):
                writer.locator(f'[data-interface-control="{kind}"]:visible').first.click()
                eraser.locator('[data-interface-control="eraser"]:visible').first.click()
                eraser.locator(f'[data-eraser-mode="{mode}"]:visible').first.click()
                original={i["id"] for i in inks(read())}
                held=[]
                control=controls[writer]
                control["commits"].clear()
                def delay_write(route):
                    if route.request.method in ("PUT","PATCH"):
                        body=route.request.post_data_json
                        changes=body.get("delta",{}).get("items",{})
                        candidates=body.get("document",{}).get("items",[])+changes.get("upsert",[])+changes.get("point_edits",[])
                        if any(i.get("id")==stroke_id for i in candidates):
                            held.append(route)
                            return
                    route.continue_()
                try:
                    box=writer.locator("section.board").bounding_box()
                    x=box["x"]+box["width"]*.42
                    y=box["y"]+box["height"]*.38
                    writer.mouse.move(x,y)
                    writer.mouse.down()
                    writer.mouse.move(x+180,y,steps=18)
                    row=wait_row(writer,lambda r:any(i["id"] not in original and i.get("width",0)>130 for i in inks(r)),
                                 "Unfinished stroke never reached the durable document")
                    stroke=next(i for i in inks(row) if i["id"] not in original)
                    stroke_id=stroke["id"]
                    stored(eraser,stroke_id)
                    expect(eraser.locator(".viewer-ink-canvas").first).to_be_attached(timeout=20000)
                    assert any(frame.get("cursor") for frame in control["commits"]), "Drawing must send a committed cursor and ink together"
                    # Check visible pixels at the actual remote cursor, not merely a stored ID.
                    eraser.wait_for_function("""()=>{
                        const cursor=document.querySelector(".lektrus-remote-cursor");
                        const board=document.querySelector("section.board");
                        if(!cursor||!board)return false;
                        const matrix=new DOMMatrix(getComputedStyle(cursor).transform);
                        const r=board.getBoundingClientRect(),x=r.left+matrix.e,y=r.top+matrix.f;
                        return Array.from(document.querySelectorAll(".viewer-ink-canvas")).some(canvas=>{
                            const b=canvas.getBoundingClientRect();
                            if(x<b.left||x>b.right||y<b.top||y>b.bottom||!canvas.width||!canvas.height)return false;
                            const px=Math.max(0,Math.min(canvas.width-1,Math.round((x-b.left)*canvas.width/b.width)));
                            const py=Math.max(0,Math.min(canvas.height-1,Math.round((y-b.top)*canvas.height/b.height)));
                            const sx=Math.max(0,px-4),sy=Math.max(0,py-4);
                            const rgba=canvas.getContext("2d").getImageData(sx,sy,Math.min(9,canvas.width-sx),Math.min(9,canvas.height-sy)).data;
                            return rgba.some((value,index)=>index%4===3&&value>30);
                        });
                    }""",timeout=5000)
                    assert eraser.locator(".remote-live-ink-layer").count()==0
                    # Hold an extension using the old version while the other
                    # participant erases the real already-committed stroke.
                    writer.route(pattern,delay_write)
                    control["hold"]=stroke_id
                    writer.mouse.move(x+240,y,steps=8)
                    for _ in range(80):
                        if held or control["held"]: break
                        writer.wait_for_timeout(100)
                    assert held or control["held"],"A growing stroke did not send a durable checkpoint"
                    midpoint=eraser.evaluate("""(stroke)=>{
                        const world=document.querySelector('.world');
                        const r=world.getBoundingClientRect();
                        const scale=new DOMMatrix(getComputedStyle(world).transform).a;
                        return {x:r.left+(stroke.x+stroke.width/2)*scale,y:r.top+(stroke.y+stroke.height/2)*scale};
                    }""",stroke)
                    eraser.mouse.move(midpoint["x"],midpoint["y"])
                    eraser.mouse.down()
                    erased=wait_row(eraser,lambda r:all(i["id"]!=stroke_id for i in inks(r)) and len(inks(r))==len(original)+(0 if mode=="stroke" else 2),
                                    f"Peer {mode} eraser failed to persist before pointer release")
                    eraser.mouse.up()
                    control["hold"]=None
                    for upstream,message in control["held"]: upstream.send(message)
                    control["held"].clear()
                    for route in held: route.continue_()
                    held.clear()
                    writer.unroute(pattern,delay_write)
                    stored(writer,stroke_id,False)
                    # More samples and pointer-up cannot recreate the removed ID.
                    writer.mouse.move(x+290,y+25,steps=10)
                    writer.mouse.up()
                    writer.wait_for_timeout(1200)
                    final=read()
                    assert final["version"]>=erased["version"]
                    assert all(i["id"]!=stroke_id for i in inks(final))
                    assert len(inks(final))==len(original)+(0 if mode=="stroke" else 2)
                    for page in (writer,eraser):
                        page.reload()
                        expect(page.locator("section.board")).to_be_visible(timeout=90000)
                        stored(page,stroke_id,False)
                    assert len(inks(read()))==len(original)+(0 if mode=="stroke" else 2)
                finally:
                    control["hold"]=None
                    for upstream,message in control["held"]:
                        try: upstream.send(message)
                        except Exception: pass
                    control["held"].clear()
                    for route in held:
                        try: route.abort()
                        except Exception: pass
                    writer.unroute(pattern,delay_write)

            # Sustained real two-UI collaboration under controlled incoming
            # packet impairment. Sample from before pointer dispatch through
            # the receiver's actual canvas raster, not transport completion.
            row=read()
            doc={**row["document"],"items":[],"ink":[]}
            client.put(url,json={"expected_version":row["version"],"document":doc}).raise_for_status()
            for page in (teacher,pupil):
                page.wait_for_function("""ident=>{
                    const raw=localStorage.getItem('lesson-board.document.v1.board.'+ident);
                    return !!raw&&JSON.parse(raw).items.length===0;
                }""",arg=ident,timeout=20000)
            relay_lateness=[]
            def pump_impairment(force=False):
                now=time.monotonic()
                for state in controls.values():
                    pending=state["delayed"];state["delayed"]=[]
                    for due,route,message in pending:
                        if force or due<=now:
                            relay_lateness.append(max(0,(time.monotonic()-due)*1000))
                            route.send(message)
                        else:state["delayed"].append((due,route,message))
            samples=[];dispatch_samples=[];post_dispatch_samples=[];expected_ids=set()
            for state in controls.values():state["impair"]=True
            started=time.monotonic()
            try:
                for round_index in range(24):
                    for side,(writer,receiver,kind) in enumerate(((teacher,pupil,"pen"),(pupil,teacher,"marker"))):
                        writer.locator(f'[data-interface-control="{kind}"]:visible').first.click()
                        box=writer.locator("section.board").bounding_box()
                        x=box["x"]+box["width"]*(.30+.28*side)
                        y=box["y"]+box["height"]*(.16+.027*round_index)
                        point=writer.evaluate("""({x,y})=>{
                            const w=document.querySelector('.world'),r=w.getBoundingClientRect();
                            const s=new DOMMatrix(getComputedStyle(w).transform).a;
                            return {x:(x-r.left)/s,y:(y-r.top)/s};
                        }""",{"x":x+50,"y":y})
                        assert ink_pixels(receiver,[point])==[False],("Test location already painted",round_index,side)
                        writer.mouse.move(x,y)
                        pointer_start=time.monotonic()
                        writer.mouse.down()
                        try:
                            # Measure a single extension event to the chosen
                            # pixel rather than ten serial automation round trips.
                            writer.mouse.move(x+100,y)
                            dispatched=time.monotonic()
                            dispatch_samples.append(round((dispatched-pointer_start)*1000,1))
                            deadline=pointer_start+5
                            while time.monotonic()<deadline:
                                pump_impairment()
                                if ink_pixels(receiver,[point])==[True]:break
                                writer.wait_for_timeout(15)
                            else:raise AssertionError(("Sustained peer raster deadline exceeded",round_index,side))
                            observed=time.monotonic()
                            samples.append(round((observed-pointer_start)*1000,1))
                            post_dispatch_samples.append(round((observed-dispatched)*1000,1))
                        finally:writer.mouse.up()
                        deadline=time.monotonic()+12
                        while time.monotonic()<deadline:
                            pump_impairment()
                            saved=inks(read())
                            added=[i for i in saved if i["id"] not in expected_ids and i["kind"]==kind and i.get("width",0)>70]
                            if added:break
                            writer.wait_for_timeout(50)
                        else:raise AssertionError(("Sustained stroke not durably saved",round_index,side))
                        assert len(added)==1,("Duplicate sustained stroke",round_index,side)
                        expected_ids.add(added[0]["id"])
                    # Maintain impaired collaboration over five real minutes.
                    while time.monotonic()<started+(round_index+1)*12.5:
                        pump_impairment()
                        teacher.wait_for_timeout(50)
            finally:
                for state in controls.values():state["impair"]=False
                pump_impairment(True)
            assert len(samples)==48 and len(expected_ids)==48
            assert time.monotonic()-started>=300
            assert {i["id"] for i in inks(read())}==expected_ids
            for page in (teacher,pupil):
                page.wait_for_function("""({ident,ids})=>{
                    const raw=localStorage.getItem('lesson-board.document.v1.board.'+ident);
                    if(!raw)return false;
                    const doc=JSON.parse(raw),items=doc.items.filter(i=>i.kind==="pen"||i.kind==="marker");
                    return items.length===ids.length&&ids.every(id=>items.some(i=>i.id===id));
                }""",arg={"ident":ident,"ids":list(expected_ids)},timeout=30000)
            drops=sum(s["dropped"] for s in controls.values())
            assert drops>0,"Impairment was never exercised"
            ordered=sorted(samples)
            # A controlled-network acceptance budget, including the artificial
            # router and automation. It is not a physical-device latency SLA.
            assert ordered[45]<1000 and ordered[-1]<1500,("Impaired peer raster tail regression",ordered[45],ordered[-1])
            print("Sustained real UI input-dispatch-to-peer-raster (ms):",json.dumps({
                "seconds":round(time.monotonic()-started,2),"strokes":len(samples),"drops":drops,
                "injected_delay_ms":120,"median":round((ordered[23]+ordered[24])/2,1),
                "p95":ordered[45],"max":ordered[-1],"samples":samples,
                "dispatch_median_ms":round((sorted(dispatch_samples)[23]+sorted(dispatch_samples)[24])/2,1),
                "post_dispatch_median_ms":round((sorted(post_dispatch_samples)[23]+sorted(post_dispatch_samples)[24])/2,1),
                "proxy_extra_delay_p95_ms":round(sorted(relay_lateness)[int((len(relay_lateness)-1)*.95)],1)
            }))
    finally:
        for ctx in contexts: ctx.close()
    print("Durable ink: visible before release; concurrent eraser defeats delayed extensions in both directions.")


def check_guest_and_registration(browser,ident):
    with httpx.Client(base_url=API,headers=headers("owner")) as client:
        links={}
        for role in ("student","observer","co_teacher"):
            response=client.post(f"/api/v1/boards/{ident}/share-links",json={"role":"viewer" if role=="observer" else "editor","participant_role":role,"max_uses":1})
            response.raise_for_status()
            links[role]=response.json()
    for role in ("student","observer","co_teacher"):
        ctx=browser.new_context(viewport={"width":390,"height":844},has_touch=True,is_mobile=True)
        page=ctx.new_page()
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(BASE+"/join/"+links[role]["token"])
        page.get_by_label("Ваше имя на доске",exact=True).fill("Guest QA")
        page.get_by_role("button",name="Продолжить как гость",exact=True).click()
        if role=="co_teacher":
            expect(page.get_by_role("alert")).to_contain_text("Для ссылки сопреподавателя войдите",timeout=30000)
            expect(page.get_by_role("button",name="Войти",exact=True)).to_be_visible()
            expect(page.locator("section.board")).to_have_count(0)
            page.screenshot(path=str(OUT/"guest-co-teacher-denied.png"))
            with httpx.Client(base_url=API,headers=headers("owner")) as client:
                result=client.get(f"/api/v1/boards/{ident}/share-links")
                result.raise_for_status()
                assert next(x for x in result.json() if x["id"]==links[role]["id"])["use_count"]==0
        else:
            page.set_viewport_size({"width":844,"height":390})
            scope=assert_board(page,ident,False,False,navigate=False,embedded=True)
            expect(page.get_by_role("button",name="Я преподаю",exact=True)).to_have_count(0)
            if role=="student":
                expect(scope.locator(".student-board-mode")).to_have_text("Гость · ученик")
            else:
                assert_viewer_mode(scope)
            assert_role_toolbar(scope,role=="student",False,touch=True)
            assert_history_controls(scope,role=="student")
            pen=scope.locator('[data-interface-control="pen"]:visible')
            if role=="student":
                expect(pen.first).to_be_visible()
            else:
                expect(pen).to_have_count(0)
            page.screenshot(path=str(OUT/f"guest-{role}-phone-board.png"))
        assert not errors, f"guest {role}: browser exceptions {errors}"
        ctx.close()
    for width,height in ((1440,900),(390,844)):
        ctx=browser.new_context(viewport={"width":width,"height":height})
        page=ctx.new_page()
        page.goto(BASE+"/app")
        page.get_by_role("button",name="Регистрация",exact=True).click()
        teacher=page.get_by_role("radio",name="Я хочу преподавать",exact=False)
        student=page.get_by_role("radio",name="Я хочу учиться",exact=False)
        teacher.check()
        expect(teacher).to_be_checked()
        student.check()
        expect(student).to_be_checked()
        expect(teacher).not_to_be_checked()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2")
        page.screenshot(path=str(OUT/f"registration-{width}.png"),full_page=True)
        ctx.close()

def check_service_unavailable(browser, ident):
    health_pattern=API+"/api/v1/health"
    for width,height in ((1440,900),(390,844),(320,640),(768,1024),(844,390)):
        ctx=browser.new_context(viewport={"width":width,"height":height},
            color_scheme="dark" if width in (320,768) else "light",service_workers="block")
        page=ctx.new_page()
        def unavailable(route):
            route.fulfill(status=503,headers={"Access-Control-Allow-Origin":BASE,"Content-Type":"application/json"},body='{"detail":"unavailable"}')
        page.route(health_pattern,unavailable)
        page.goto(BASE+"/app")
        screen=page.locator(".lektrus-unavailable")
        expect(screen).to_be_visible(timeout=30000)
        expect(screen.get_by_role("heading",name="Скоро вернёмся")).to_be_visible()
        expect(screen.get_by_role("button",name="Повторить попытку")).to_be_enabled()
        expect(screen.get_by_role("link",name="Написать в Telegram @lektrus")).to_have_attribute("href","https://t.me/lektrus")
        expect(screen.get_by_role("link",name="Написать на почту lektrus.system@inbox.ru")).to_have_attribute("href",re.compile(r"^mailto:lektrus\.system@inbox\.ru"))
        geometry=screen.evaluate("""node => {
          const card=node.querySelector('.u-card').getBoundingClientRect();
          const retry=node.querySelector('.u-retry').getBoundingClientRect();
          return {width:node.clientWidth,scrollWidth:node.scrollWidth,
            left:card.left,right:card.right,top:card.top,bottom:card.bottom,retryHeight:retry.height,
            contacts:[...node.querySelectorAll('.u-support-link')].map(el=>{const r=el.getBoundingClientRect();return {h:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right}})}
        }""")
        assert geometry["scrollWidth"]<=width+1 and geometry["left"]>=0 and geometry["right"]<=width+1,geometry
        assert geometry["retryHeight"]>=44 and geometry["top"]>=0 and geometry["bottom"]<=height+1,geometry
        assert all(r["h"]>=44 and r["top"]>=0 and r["bottom"]<=height+1 and r["left"]>=0 and r["right"]<=width+1 for r in geometry["contacts"]),geometry
        page.screenshot(path=str(OUT/f"service-unavailable-{width}x{height}.png"))
        page.unroute(health_pattern,unavailable)
        screen.get_by_role("button",name="Повторить попытку").click()
        expect(page.get_by_label("Email",exact=True)).to_be_visible(timeout=30000)
        expect(screen).to_have_count(0)
        assert page.url==BASE+"/app"
        ctx.close()

    ctx=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
    page=ctx.new_page()
    page.goto(BASE+"/app")
    expect(page.get_by_label("Email",exact=True)).to_be_visible(timeout=30000)
    ctx.set_offline(True)
    expect(page.get_by_role("heading",name="Вы не в сети",exact=True)).to_be_visible(timeout=30000)
    page.screenshot(path=str(OUT/"service-offline-phone.png"))
    ctx.set_offline(False)
    expect(page.get_by_label("Email",exact=True)).to_be_visible(timeout=30000)
    ctx.close()

    # Reproduce the API 24 release failure: a health probe fails while the
    # native auth form is open. No production login or new account is needed.
    ctx=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
    ctx.add_init_script("window.CapacitorCustomPlatform={name:'android'}")
    page=ctx.new_page()
    with page.expect_response(lambda response: response.url==health_pattern and response.ok,timeout=30000):
        page.goto(BASE+"/app")
    page.get_by_role("button",name="Регистрация",exact=True).click()
    email=page.get_by_label("Email",exact=True)
    email.fill("native-form@example.test")
    page.route(health_pattern,unavailable)
    page.evaluate("window.dispatchEvent(new Event('lektrus:service-request-failed'))")
    notice=page.locator(".auth-connection-notice")
    expect(notice).to_be_visible(timeout=30000)
    expect(page.get_by_role("button",name="Вход",exact=True)).to_be_visible()
    expect(email).to_have_value("native-form@example.test")
    expect(page.locator(".lektrus-unavailable")).to_have_count(0)
    page.unroute(health_pattern,unavailable)
    notice.get_by_role("button",name="Проверить соединение").click()
    expect(notice).to_have_count(0,timeout=30000)
    expect(page.get_by_role("heading",name="Создать аккаунт")).to_be_visible()
    expect(email).to_have_value("native-form@example.test")
    page.get_by_role("button",name="Вход",exact=True).click()
    expect(page.get_by_role("heading",name="С возвращением")).to_be_visible()
    ctx.close()

    # The public landing page and standalone fallback share the same contacts.
    ctx=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
    page=ctx.new_page()
    page.route(health_pattern,unavailable)
    page.goto(BASE+"/#home")
    screen=page.locator(".lektrus-unavailable")
    expect(screen.get_by_role("heading",name="Скоро вернёмся")).to_be_visible(timeout=30000)
    expect(screen.locator("[data-u-support-telegram]")).to_be_visible()
    expect(screen.locator("[data-u-support-email]")).to_be_visible()
    page.screenshot(path=str(OUT/"service-unavailable-public.png"))
    page.unroute(health_pattern,unavailable)
    screen.get_by_role("button",name="Повторить попытку").click()
    expect(page.locator(".marketing-site")).to_be_visible(timeout=30000)
    expect(screen).to_have_count(0)
    assert page.url==BASE+"/#home"
    page.goto(BASE+"/service-unavailable.html")
    expect(screen.locator("[data-u-support-telegram]")).to_have_attribute("href","https://t.me/lektrus")
    expect(screen.locator("[data-u-support-email]")).to_have_attribute("href",re.compile(r"^mailto:lektrus\.system@inbox\.ru"))
    ctx.close()

    # An isolated error is not a service outage; the board retains its
    # original recovery behavior, and a live board never gets replaced.
    ctx=browser.new_context(viewport={"width":1440,"height":900},service_workers="block")
    page=ctx.new_page()
    login(page,"owner")
    assert_board(page,ident,True,True)
    page.route(health_pattern,unavailable)
    page.evaluate("window.dispatchEvent(new Event('lektrus:service-request-failed'))")
    expect(page.locator("section.board")).to_be_visible()
    expect(page.locator(".lektrus-unavailable")).to_have_count(0)
    ctx.close()
    print("Service recovery: five responsive sizes, dark theme, offline/online, retry and active-board safety passed")

def assert_maintenance_layout(site, ordinary):
    # The desktop fixed sidebar previously covered the icon and entire text.
    # Exercise the site's actual light palette with a dark OS preference too.
    for theme in ("light","dark"):
        site.emulate_media(color_scheme=theme)
        ordinary.emulate_media(color_scheme=theme)
        for width,height in ((320,568),(390,844),(768,1024),(1024,768),(1440,900),(1920,1080),(844,390)):
            site.set_viewport_size({"width":width,"height":height})
            notice=site.locator(".maintenance-notice-public")
            expect(notice).to_be_visible()
            expect(notice.locator("strong")).to_be_visible()
            geom=site.evaluate("""() => {
                const banner=document.querySelector('.maintenance-notice-public'),title=banner.querySelector('strong'),main=document.querySelector('#marketing-main'),header=document.querySelector('.marketing-header');
                const b=banner.getBoundingClientRect(),t=title.getBoundingClientRect(),m=main.getBoundingClientRect(),h=header.getBoundingClientRect();
                const visible=(r,el)=>el.contains(document.elementFromPoint(r.left+Math.min(8,r.width/2),r.top+r.height/2));
                return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,mainLeft:m.left,headerRight:h.right,headerBottom:h.bottom,headerFixed:getComputedStyle(header).position==='fixed',textVisible:visible(t,title),iconVisible:visible(banner.querySelector('.maintenance-notice-icon').getBoundingClientRect(),banner),fg:getComputedStyle(title).color,bg:getComputedStyle(banner).backgroundColor,scroll:document.documentElement.scrollWidth};
            }""")
            assert geom["left"]>=geom["mainLeft"]-1 and geom["right"]<=width+1, geom
            assert geom["top"]>=0 and geom["bottom"]<=height,geom
            assert geom["textVisible"] and geom["iconVisible"],geom
            assert geom["fg"]=="rgb(23, 69, 121)" and geom["bg"]=="rgb(232, 243, 255)",geom
            assert geom["scroll"]<=width+2,geom
            if geom["headerFixed"]:
                assert geom["left"]>=geom["headerRight"]-1,geom
            else:
                assert geom["top"]>=geom["headerBottom"]-1,geom
            ordinary.set_viewport_size({"width":width,"height":height})
            screen=ordinary.locator(".maintenance-blocking")
            expect(screen).to_be_visible()
            expect(screen.locator("button,a,input,[role=button],[tabindex='0']")).to_have_count(0)
            expect(screen.get_by_role("heading",name="Скоро вернёмся")).to_be_visible()
            expect(screen).not_to_contain_text("Проблема с подключением")
            layout=screen.evaluate("""el=>{const r=el.getBoundingClientRect(),s=el.querySelector('.maintenance-screen').getBoundingClientRect(),heading=el.querySelector('h1').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,contentWidth:s.width,scroll:el.scrollWidth,headingLeft:heading.left,headingRight:heading.right,headingTop:heading.top,headingBottom:heading.bottom}}""")
            assert abs(layout["x"])<=1 and abs(layout["y"])<=1 and abs(layout["w"]-width)<=1 and abs(layout["h"]-height)<=1,layout
            assert layout["scroll"]<=width+1 and layout["headingLeft"]>=0 and layout["headingRight"]<=width+1 and layout["headingBottom"]<=height,layout
            if width in (390,1440,844):
                site.screenshot(path=str(OUT/f"maintenance-public-{theme}-{width}.png"))
                ordinary.screenshot(path=str(OUT/f"maintenance-fullscreen-{theme}-{width}.png"))
    site.set_viewport_size({"width":390,"height":844})
    ordinary.set_viewport_size({"width":390,"height":844})


def check_maintenance(browser,ident):
    async def promote():
        conn=await asyncpg.connect(os.environ["DATABASE_URL"])
        try:
            await conn.execute("UPDATE account_users SET is_admin=true WHERE email='owner@roles.example'")
        finally:
            await conn.close()
    # Playwright's sync API owns an event loop on this thread.
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=1) as executor:
        executor.submit(lambda: asyncio.run(promote())).result()
    contexts=[browser.new_context(viewport={"width":1440,"height":900},service_workers="block"),
              browser.new_context(viewport={"width":390,"height":844},service_workers="block"),
              browser.new_context(viewport={"width":390,"height":844},service_workers="block"),
              browser.new_context(viewport={"width":390,"height":844},service_workers="block")]
    admin,ordinary,selected,site=[ctx.new_page() for ctx in contexts]
    try:
        login(admin,"owner")
        seed_legacy_empty_toolbar(admin)
        assert_board(admin,ident,True,True)
        assert_role_toolbar(admin,True,True)
        # Explicit desktop customization is reflected immediately and survives reload.
        configure=admin.locator(".toolbar.compact-toolbar .lectris-tools-configure")
        configure.click()
        settings=admin.get_by_role("dialog",name="Настройка панели инструментов")
        expect(settings).to_be_visible()
        settings.get_by_role("button",name="Маркер: убрать в дополнительные").click()
        settings.get_by_role("button",name="Сохранить",exact=True).click()
        expect(admin.locator('.toolbar-pinned [data-interface-control="marker"]')).to_have_count(0)
        admin.reload()
        expect(admin.locator("section.board")).to_be_visible(timeout=90000)
        expect(admin.locator('.toolbar-pinned [data-interface-control="marker"]')).to_have_count(0)
        configure.click()
        expect(settings).to_be_visible()
        settings.get_by_role("button",name="По умолчанию").click()
        settings.get_by_role("button",name="Сохранить",exact=True).click()
        assert_role_toolbar(admin,True,True)
        login(ordinary,"learner")
        login(selected,"colleague")
        admin.goto(BASE+"/app?section=admin")
        admin.get_by_role("button",name="Техработы",exact=True).click(timeout=30000)
        panel=admin.locator(".admin-maintenance")
        expect(panel.get_by_text("Сервис работает в обычном режиме")).to_be_visible(timeout=30000)
        dates=admin.evaluate("""() => [1,2].map(h=>{const d=new Date(Date.now()+h*3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)})""")
        panel.get_by_label("Начало",exact=True).fill(dates[0])
        panel.get_by_label("Окончание (необязательно)",exact=True).fill(dates[1])
        panel.get_by_label("Сообщение для пользователей").fill("Обновляем систему досок")
        panel.locator("label").filter(has_text="colleague@roles.example").get_by_role("checkbox").check(timeout=30000)
        panel.get_by_role("button",name="Сохранить расписание").click()
        expect(panel.get_by_text("Работы запланированы",exact=True)).to_be_visible(timeout=15000)
        site.goto(BASE+"/")
        expect(site.locator(".maintenance-notice")).to_contain_text("Запланированы технические работы",timeout=15000)
        ordinary.bring_to_front()
        ordinary.evaluate("window.dispatchEvent(new Event('lektrus:maintenance-changed'))")
        expect(ordinary.locator(".maintenance-notice")).to_contain_text("Запланированы технические работы",timeout=15000)
        expect(ordinary.get_by_role("button",name="Я учусь",exact=True)).to_be_visible()
        admin.once("dialog",lambda d:d.accept())
        panel.get_by_role("button",name="Начать сейчас").click()
        expect(panel.get_by_text("Сейчас ведутся технические работы",exact=True)).to_be_visible(timeout=15000)
        for page in (ordinary,selected,site):
            page.bring_to_front()
            page.evaluate("window.dispatchEvent(new Event('lektrus:maintenance-changed'))")
        expect(ordinary.locator(".maintenance-blocking")).to_contain_text("Технические работы",timeout=15000)
        expect(ordinary.locator(".maintenance-blocking")).to_contain_text("Обновляем систему досок")
        expect(selected.locator(".maintenance-notice")).to_contain_text("У вас есть доступ",timeout=15000)
        expect(selected.get_by_role("button",name="Я учусь",exact=True)).to_be_visible()
        expect(site.locator(".maintenance-notice")).to_contain_text("Ведутся технические работы",timeout=15000)
        assert_maintenance_layout(site,ordinary)
        for page,name in [(admin,"admin"),(ordinary,"blocked-phone"),(selected,"allowed-phone"),(site,"site-phone")]:
            page.screenshot(path=str(OUT/f"maintenance-{name}.png"))
        # No controls on the blocked deep link. The normal login entry still works.
        fresh=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
        try:
            page=fresh.new_page();page.goto(BASE+"/board/00000000-0000-4000-8000-000000000000")
            expect(page.locator(".maintenance-blocking")).to_be_visible(timeout=15000)
            expect(page.locator(".maintenance-blocking button")).to_have_count(0)
            login(page,"colleague")
            expect(page.locator(".maintenance-blocking")).to_have_count(0)
            expect(page.locator(".maintenance-notice")).to_contain_text("У вас есть доступ",timeout=15000)
        finally:
            fresh.close()
        panel.get_by_role("button",name="Завершить работы").click()
        expect(panel.get_by_text("Сервис работает в обычном режиме",exact=True)).to_be_visible(timeout=15000)
        ordinary.bring_to_front()
        ordinary.evaluate("window.dispatchEvent(new Event('lektrus:maintenance-changed'))")
        expect(ordinary.locator(".maintenance-blocking")).to_have_count(0,timeout=15000)
        expect(ordinary.get_by_role("button",name="Я учусь",exact=True)).to_be_visible()
    finally:
        for ctx in contexts:ctx.close()
    print("Maintenance: scheduled banner, admin and selected access, blocked account, login and automatic recovery passed")

def check_billing_and_finance(browser):
    contexts=[browser.new_context(viewport={"width":1440,"height":900},service_workers="block"),
              browser.new_context(viewport={"width":390,"height":844},service_workers="block")]
    admin,member=[ctx.new_page() for ctx in contexts]
    try:
        login(admin,"owner")
        login(member,"colleague")
        member.goto(BASE+"/app?section=billing")
        expect(member.get_by_role("heading",name="Тарифы и использование")).to_be_visible(timeout=30000)
        expect(member.locator(".billing-card")).to_have_count(2)
        expect(member.locator(".billing-usage-grid")).to_be_visible(timeout=30000)
        card=member.get_by_role("region",name="Моё хранилище")
        expect(card).to_be_visible(timeout=30000)
        expect(card.get_by_text("из 250 МБ",exact=True)).to_be_visible()
        expect(card.get_by_text("Файлы на досках",exact=True)).to_be_visible()
        expect(card.get_by_role("progressbar")).to_have_attribute("max","262144000")
        for w,h in ((390,844),(844,390),(768,1024),(1440,900)):
            member.set_viewport_size({"width":w,"height":h})
            assert card.evaluate("el=>el.scrollWidth<=el.clientWidth+2"),(w,h)
        member.set_viewport_size({"width":390,"height":844})
        member.screenshot(path=str(OUT/"billing-free-phone.png"))
        admin.goto(BASE+"/app?section=admin")
        admin.get_by_role("button",name="Финансы",exact=True).click(timeout=30000)
        panel=admin.locator(".finance-panel")
        expect(panel.get_by_role("heading",name="Финансы и подписки")).to_be_visible(timeout=30000)
        expect(panel.get_by_text("Покупок пока нет.",exact=False)).to_be_visible(timeout=30000)
        panel.get_by_label("Текущий баланс ₽").fill("1500")
        panel.get_by_role("button",name="Зафиксировать баланс").click()
        expect(panel.get_by_text("Баланс по последней ручной сверке",exact=False)).to_be_visible(timeout=15000)
        admin.screenshot(path=str(OUT/"admin-finance-desktop.png"))
        admin.get_by_role("button",name="Хранилище",exact=True).click()
        storage=admin.get_by_role("region",name="Хранилище и база данных")
        expect(storage.get_by_text("Размер базы PostgreSQL",exact=True)).to_be_visible(timeout=30000)
        expect(storage.get_by_text("public.board_history",exact=True)).to_be_visible()
        storage.get_by_role("button",name="Пользователи",exact=True).click()
        expect(storage.get_by_text("colleague@roles.example",exact=True)).to_be_visible()
        storage.get_by_role("button",name=re.compile("^Гости")).click()
        expect(storage.get_by_role("heading",name="Гостевые аккаунты")).to_be_visible()
        expect(storage.get_by_text("Ожидают очистки",exact=True)).to_be_visible()
        storage.get_by_role("button",name="Таблицы",exact=True).click()
        expect(storage.get_by_text("public.board_history",exact=True)).to_be_visible()
        for w,h in ((1440,900),(768,1024),(844,390),(390,844)):
            admin.set_viewport_size({"width":w,"height":h})
            assert storage.evaluate("el=>el.scrollWidth<=el.clientWidth+2"),(w,h)
        admin.screenshot(path=str(OUT/"admin-storage-phone.png"))

    finally:
        for ctx in contexts:ctx.close()

def check_undo_reconnect_sync(browser):
    """Two actual accounts, personal inverse history, network loss and durable convergence."""
    ident=setup_board()
    url=f"/api/v1/boards/{ident}/document"
    contexts=[browser.new_context(viewport={"width":1440,"height":900},service_workers="block") for _ in range(2)]
    teacher,pupil=[ctx.new_page() for ctx in contexts]
    pupil_sockets=[]
    pupil_lifecycle=[]
    drop_results={"enabled":False,"count":0}
    def pupil_socket(route):
        upstream=route.connect_to_server()
        pupil_sockets.append((route,upstream))
        index=len(pupil_sockets)
        def outgoing(message):
            event=json.loads(message)
            if event.get("type") in ("auth","activity"):
                pupil_lifecycle.append((index,event["type"],event.get("background"),event.get("idle_age_ms")))
            upstream.send(message)
        route.on_message(outgoing)
        def incoming(message):
            event=json.loads(message)
            if drop_results["enabled"] and event.get("type")=="attachment_result":
                drop_results["count"]+=1
                return
            route.send(message)
        upstream.on_message(incoming)
    pupil.route_web_socket(re.compile(r"/api/v1/boards/[^/]+/events"),pupil_socket)
    try:
        login(teacher,"owner")
        login(pupil,"learner")
        assert_board(teacher,ident,True,True)
        assert_board(pupil,ident,False,False)
        with httpx.Client(base_url=API,headers=headers("owner")) as client:
            def read():
                r=client.get(url);r.raise_for_status()
                return r.json()["document"]
            def ids(doc):
                return {i["id"] for i in doc["items"] if i["kind"] in ("pen","marker")}
            def wait_api(page,predicate,label):
                for _ in range(120):
                    doc=read()
                    if predicate(doc):return doc
                    page.wait_for_timeout(100)
                raise AssertionError(f"{label}; server items={[(i.get('id'),i.get('kind'),i.get('createdBy')) for i in doc['items']]}; page={page.locator('body').inner_text()[-1000:]}")
            def stored(page,stroke_id,present=True):
                page.wait_for_function("""({ident,id,present})=>{
                    const raw=localStorage.getItem('lesson-board.document.v1.board.'+ident);
                    return !!raw&&JSON.parse(raw).items.some(i=>i.id===id)===present;
                }""",arg={"ident":ident,"id":stroke_id,"present":present},timeout=30000)
            def draw(page,kind,fraction):
                before=ids(read())
                page.locator(f'[data-interface-control="{kind}"]:visible').first.click()
                box=page.locator("section.board").bounding_box()
                x=box["x"]+box["width"]*.70
                y=box["y"]+box["height"]*fraction
                page.mouse.move(x,y);page.mouse.down()
                page.mouse.move(x+110,y+8,steps=12);page.mouse.up()
                doc=wait_api(page,lambda d:any(i["kind"]==kind and i["id"] not in before and i.get("width",0)>70 for i in d["items"]),f"{kind} not persisted")
                return next(i["id"] for i in doc["items"] if i["kind"]==kind and i["id"] not in before)
            def both(stroke_id,present=True):
                for page in (teacher,pupil):stored(page,stroke_id,present)
            first=draw(teacher,"pen",.58);both(first)
            second=draw(pupil,"marker",.74);both(second)
            for actor,mine,peer in ((teacher,first,second),(pupil,second,first)):
                undo=actor.locator(".mobile-undo-redo").get_by_role("button",name="Отменить",exact=True)
                redo=actor.locator(".mobile-undo-redo").get_by_role("button",name="Повторить",exact=True)
                expect(undo).to_be_enabled(timeout=10000);undo.click()
                wait_api(actor,lambda d:mine not in ids(d) and peer in ids(d),f"{'teacher' if actor is teacher else 'student'} undo failed: remove {mine}, preserve {peer}")
                both(mine,False);both(peer)
                expect(redo).to_be_enabled(timeout=10000);redo.click()
                wait_api(actor,lambda d:{mine,peer}<=ids(d),"Redo did not converge")
                both(mine);both(peer)
            # Actual browser offline state and transport close, not synthetic
            # revision injection. A missed server update must arrive on wake.
            pupil.context.set_offline(True)
            for route,upstream in list(pupil_sockets):
                for socket in (route,upstream):
                    try:socket.close(code=4000,reason="QA network loss")
                    except Exception:pass
            pupil.wait_for_function("navigator.onLine===false")
            third=draw(teacher,"marker",.40)
            stored(teacher,third)
            pupil.context.set_offline(False)
            pupil.wait_for_function("navigator.onLine===true")
            both(third)
            pupil.reload()
            expect(pupil.locator("section.board")).to_be_visible(timeout=90000)
            for stroke in (first,second,third):stored(pupil,stroke)
            assert {first,second,third}<=ids(read())
            print("Real dual-session undo/redo for both roles, network loss and reload passed.")

            # Multiple separate outages in the same live lesson, alternating
            # authors after every recovery. No reload or reconnect button is used.
            outage_strokes=[]
            for index in range(3):
                pupil.context.set_offline(True)
                for route,upstream in list(pupil_sockets):
                    for socket in (route,upstream):
                        try:socket.close(code=4000,reason="QA repeated outage")
                        except Exception:pass
                pupil.wait_for_function("navigator.onLine===false")
                missed=draw(teacher,"pen",.31+index*.08)
                stored(teacher,missed)
                pupil.context.set_offline(False)
                pupil.wait_for_function("navigator.onLine===true")
                both(missed)
                recovered=draw(pupil,"marker",.51+index*.08)
                both(recovered)
                outage_strokes.extend((missed,recovered))
                assert set(outage_strokes)<=ids(read()),"Repeated outage lost an earlier durable stroke"
            print("Three repeated real transport outages and bidirectional post-reconnect writes converged.")

            # Text is durably checkpointed while the textarea is focused.
            # A pupil revision during that session must not destroy the
            # teacher's personal text undo action or cancel the editor.
            row=client.get(url).json()
            author=next(i["createdBy"] for i in row["document"]["items"] if i["id"]==first)
            text_id="qa-checkpoint-text"
            item={"id":text_id,"kind":"text","x":200,"y":160,"width":240,"height":90,
                  "text":"Initial text","createdBy":author,"color":"#202124"}
            client.put(url,json={"expected_version":row["version"],"document":{**row["document"],"items":[*row["document"]["items"],item]}}).raise_for_status()
            selector=f'.board-object[data-object="{text_id}"]'
            both(text_id)
            teacher.locator('[data-interface-control="select"]:visible').first.click()
            teacher.locator(selector).dblclick()
            field=teacher.locator(selector+" textarea")
            expect(field).to_be_visible(timeout=10000)
            field.fill("Checkpointed text")
            wait_api(teacher,lambda d:any(i["id"]==text_id and i["text"]=="Checkpointed text" for i in d["items"]),"Typing checkpoint not saved")
            unrelated=draw(pupil,"pen",.84)
            both(unrelated)
            expect(field).to_have_value("Checkpointed text")
            field.press("Control+Enter")
            expect(field).to_have_count(0)
            undo=teacher.locator(".mobile-undo-redo").get_by_role("button",name="Отменить",exact=True)
            redo=teacher.locator(".mobile-undo-redo").get_by_role("button",name="Повторить",exact=True)
            expect(undo).to_be_enabled();undo.click()
            wait_api(teacher,lambda d:unrelated in ids(d) and any(i["id"]==text_id and i["text"]=="Initial text" for i in d["items"]),"Text checkpoint undo reverted wrong action")
            expect(pupil.locator(selector)).to_contain_text("Initial text")
            expect(redo).to_be_enabled();redo.click()
            wait_api(teacher,lambda d:unrelated in ids(d) and any(i["id"]==text_id and i["text"]=="Checkpointed text" for i in d["items"]),"Text checkpoint redo failed")
            expect(pupil.locator(selector)).to_contain_text("Checkpointed text")
            teacher.locator(selector).dblclick()
            expect(field).to_be_visible()
            field.fill("Cancelled text")
            wait_api(teacher,lambda d:any(i["id"]==text_id and i["text"]=="Cancelled text" for i in d["items"]),"Cancel scenario did not checkpoint")
            field.press("Escape")
            wait_api(teacher,lambda d:any(i["id"]==text_id and i["text"]=="Checkpointed text" for i in d["items"]),"Escape failed to revert checkpoint")
            expect(pupil.locator(selector)).to_contain_text("Checkpointed text")
            print("Real checkpointed text undo/redo/cancel after a peer revision passed.")

            # A real uploaded file must survive loss of the approval message
            # without duplicate board objects, and a pending request survives
            # the pupil's page reload.
            def chunk(tag,data):
                return struct.pack(">I",len(data))+tag+data+struct.pack(">I",zlib.crc32(tag+data)&0xffffffff)
            png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",24,16,8,2,0,0,0))+chunk(b"IDAT",zlib.compress((b"\0"+b"\x15\x66\xbb"*24)*16))+chunk(b"IEND",b"")
            def upload(name):
                pupil.locator('input[aria-label="Добавить фото или PDF"]').set_input_files({"name":name,"mimeType":"image/png","buffer":png})
                expect(pupil.locator(".student-media-pending")).to_be_visible(timeout=30000)
                expect(teacher.locator(".teacher-media-request-head")).to_contain_text(name,timeout=30000)
            upload("sync-approval.png")
            assert not any(i["kind"]=="image" for i in read()["items"])
            pupil.reload()
            expect(pupil.locator("section.board")).to_be_visible(timeout=90000)
            expect(pupil.locator(".student-media-pending")).to_be_visible(timeout=30000)
            drop_results["enabled"]=True
            teacher.locator(".teacher-media-request-actions button.approve").click()
            added=wait_api(teacher,lambda d:any(i["kind"]=="image" and i.get("name")=="sync-approval.png" for i in d["items"]),"Approved image never committed")
            item=next(i for i in added["items"] if i["kind"]=="image" and i.get("name")=="sync-approval.png")
            both(item["id"])
            expect(pupil.locator(".student-media-pending")).to_have_count(0,timeout=30000)
            pupil.wait_for_timeout(4500)
            assert sum(i.get("assetId")==item["assetId"] for i in read()["items"])==1
            expect(teacher.locator(".teacher-media-request-head")).to_have_count(0,timeout=10000)
            # A rejected upload has no board object to acknowledge it. The
            # teacher must replay the decision after the result is lost/reload.
            upload("sync-rejection.png")
            teacher.locator(".teacher-media-request-actions button.reject").click()
            expect(teacher.locator(".teacher-media-request-head")).to_have_count(0,timeout=10000)
            expect(pupil.locator(".student-media-pending")).to_be_visible()
            teacher.reload()
            expect(teacher.locator("section.board")).to_be_visible(timeout=90000)
            drop_results["enabled"]=False
            expect(pupil.locator(".student-media-pending")).to_have_count(0,timeout=30000)
            assert not any(i.get("name")=="sync-rejection.png" for i in read()["items"])
            print("Real attachment request reload, lost approval, duplicate protection and rejected-result replay passed.")

            # Load all six protected assignment families through the real
            # document API. The pupil may position them but cannot delete or
            # change their construction, regardless of input method.
            row=client.get(url).json()
            author=next(i["createdBy"] for i in row["document"]["items"] if i["id"]==first)
            payloads={
                "frame":{},
                "checklist":{"checklistItems":["Task"],"checklistDone":[False]},
                "quiz":{"quizOptions":["A","B"],"quizCorrect":0},
                "flashcard":{"flashcardBack":"Answer"},
                "cover":{"coverOpen":False,"coverOpacity":1},
                "linkmedia":{"mediaUrl":"https://example.test/video","mediaTitle":"Video"},
            }
            lesson_items=[{"id":"qa-protected-"+kind,"kind":kind,"x":100+(n%3)*380,"y":100+(n//3)*280,
                           "width":260,"height":180,"text":"QA "+kind,"createdBy":author,**fields}
                          for n,(kind,fields) in enumerate(payloads.items())]
            base_positions={i["id"]:i["x"] for i in lesson_items}
            document={**row["document"],"items":lesson_items}
            client.put(url,json={"expected_version":row["version"],"document":document}).raise_for_status()
            for obj in lesson_items:
                both(obj["id"])
            def geometry_synced(page,expected):
                page.wait_for_function("""({ident,expected})=>{
                    const raw=localStorage.getItem('lesson-board.document.v1.board.'+ident);
                    if(!raw)return false;
                    const map=new Map(JSON.parse(raw).items.map(i=>[i.id,i]));
                    return expected.every(i=>{const a=map.get(i.id);return a&&Math.abs(a.x-i.x)<0.01&&Math.abs(a.y-i.y)<0.01&&Math.abs(a.width-i.width)<0.01&&Math.abs(a.height-i.height)<0.01&&(a.rotation||0)===(i.rotation||0)});
                }""",arg={"ident":ident,"expected":expected},timeout=30000)
            pupil.locator('[data-interface-control="select"]:visible').first.click()
            pupil.keyboard.press("Control+a")
            pupil.keyboard.press("Shift+ArrowRight")
            moved=wait_api(pupil,lambda d:len(d["items"])==len(lesson_items) and all(
                abs(i["x"]-base_positions[i["id"]]-10)<0.01 for i in d["items"]),"Protected lesson keyboard move rejected")
            for page in (teacher,pupil):geometry_synced(page,moved["items"])
            pupil.keyboard.press("Alt+ArrowRight")
            rotated=wait_api(pupil,lambda d:len(d["items"])==len(lesson_items) and all(
                i.get("rotation")==90 for i in d["items"]),"Protected lesson keyboard rotation rejected")
            for page in (teacher,pupil):geometry_synced(page,rotated["items"])
            pupil.keyboard.press("Delete")
            pupil.wait_for_timeout(1000)
            assert {i["id"] for i in read()["items"]}==set(base_positions),"Pupil deleted protected assignment"
            # A teacher lock blocks keyboard transforms too.
            row=client.get(url).json()
            locked={**row["document"],"items":[{**i,"locked":True} for i in row["document"]["items"]]}
            client.put(url,json={"expected_version":row["version"],"document":locked}).raise_for_status()
            pupil.wait_for_function("""ident=>{
                const raw=localStorage.getItem('lesson-board.document.v1.board.'+ident);
                return !!raw&&JSON.parse(raw).items.length===6&&JSON.parse(raw).items.every(i=>i.locked);
            }""",arg=ident,timeout=30000)
            pupil.keyboard.press("Control+a")
            pupil.keyboard.press("Shift+ArrowRight")
            pupil.keyboard.press("Alt+ArrowRight")
            pupil.wait_for_timeout(1000)
            assert read()["items"]==locked["items"],"Keyboard transformed locked assignment"
            print("All six protected assignment kinds: pupil keyboard translation/rotation, peer convergence, deletion and lock denial passed.")

            def replace_items(items):
                row=client.get(url).json()
                client.put(url,json={"expected_version":row["version"],"document":{**row["document"],"items":items}}).raise_for_status()
                for page in (teacher,pupil):
                    page.wait_for_function("""({ident,ids})=>{
                        const raw=localStorage.getItem('lesson-board.document.v1.board.'+ident);
                        return !!raw&&JSON.stringify(JSON.parse(raw).items.map(i=>i.id))===JSON.stringify(ids);
                    }""",arg={"ident":ident,"ids":[i["id"] for i in items]},timeout=30000)
            def select_all(page):
                page.locator('[data-interface-control="select"]:visible').first.click()
                page.keyboard.press("Control+a")
            def peer_move(obj):
                select_all(pupil)
                pupil.keyboard.press("Shift+ArrowRight")
                changed=wait_api(pupil,lambda d:any(i["id"]==obj["id"] and abs(i["x"]-obj["x"]-10)<0.01 for i in d["items"]),"Peer transform did not save")
                for page in (teacher,pupil):geometry_synced(page,changed["items"])
                return next(i for i in changed["items"] if i["id"]==obj["id"])
            def peer_resize_rotate(obj):
                select_all(pupil)
                handle=pupil.locator('.screen-transform-overlay [data-transform-handle="se"]:visible').first
                expect(handle).to_be_visible(timeout=10000)
                pos=handle.bounding_box()
                x=pos["x"]+pos["width"]/2;y=pos["y"]+pos["height"]/2
                pupil.mouse.move(x,y);pupil.mouse.down()
                try:pupil.mouse.move(x+35,y+25,steps=5)
                finally:pupil.mouse.up()
                changed=wait_api(pupil,lambda d:any(i["id"]==obj["id"] and (abs(i["width"]-obj["width"])>2 or abs(i["height"]-obj["height"])>2) for i in d["items"]),"Peer resize not saved: "+obj["kind"])
                for page in (teacher,pupil):geometry_synced(page,changed["items"])
                current=next(i for i in changed["items"] if i["id"]==obj["id"])
                pupil.keyboard.press("Alt+ArrowRight")
                rotated=wait_api(pupil,lambda d:any(i["id"]==obj["id"] and (i.get("rotation",0)-current.get("rotation",0))%360==90 for i in d["items"]),"Peer rotation not saved: "+obj["kind"])
                for page in (teacher,pupil):geometry_synced(page,rotated["items"])
                return next(i for i in rotated["items"] if i["id"]==obj["id"])
            # Uploaded image is the real asset from the approval scenario.
            replace_items([item])
            moved_image=peer_move(item)
            peer_resize_rotate(moved_image)
            select_all(teacher);teacher.keyboard.press("Delete")
            both(item["id"],False)
            print("Real uploaded image move, rotation and deletion converged.")
            def open_existing(obj,dialog):
                teacher.locator('[data-interface-control="select"]:visible').first.click()
                # Embedded subject widgets deliberately stop double-click propagation.
                # Select the object using the board keyboard, then use its public settings control.
                if obj["kind"]=="graph":
                    teacher.keyboard.press("Control+a")
                    teacher.get_by_role("button",name="Настроить учебный объект",exact=True).click()
                else:
                    teacher.locator(f'.board-object[data-object="{obj["id"]}"]').dblclick(position={"x":12,"y":12})
                expect(teacher.locator(dialog)).to_be_visible(timeout=15000)
                return teacher.locator(dialog)

            # Real chart/fraction/periodic/atom editors must preserve geometry
            # changed by the pupil while a detached draft is still open.
            subject_cases=[
                ("chart",{"kind":"graph","graphFigureId":"lektrus-chart","chartStyle":"bar","chartEntries":[{"label":"A","value":1}]},
                 ".lektrus-data-chart-dialog",'input[placeholder="Название диаграммы"]',".primary"),
                ("fraction",{"kind":"fraction","fractionMode":"circle","fractionNumerator":1,"fractionDenominator":4},
                 ".lektrus-fraction-dialog",'.lektrus-fraction-fields > label:first-child input',".primary"),
                ("periodic",{"kind":"graph","graphFigureId":"chem-periodic","graphPurpose":"geometry","graphAxisMode":"none","sciencePeriodicHighlights":[8],"sciencePeriodicLayout":"school","sciencePeriodicShowNames":True},
                 ".lektrus-periodic-dialog",'.lektrus-periodic-panel label:first-child input',".primary"),
                ("atom",{"kind":"graph","graphFigureId":"chem-atom","graphPurpose":"geometry","graphAxisMode":"none","scienceAtomModel":{"atomicNumber":8,"mode":"shell","labelX":0,"labelY":0,"showElectronConfiguration":True}},
                 ".lektrus-atom-dialog",'.lektrus-atom-controls label:first-child input',".primary"),
            ]
            for name,fields,dialog,field,save in subject_cases:
                obj={"id":"qa-detached-"+name,"x":220,"y":160,"width":520,"height":360,"text":"Initial "+name,"createdBy":author,**fields}
                replace_items([obj])
                editor=open_existing(obj,dialog)
                editor.locator(field).fill("Edited "+name)
                moved=peer_move(obj)
                editor.locator(save).click()
                expect(editor).to_have_count(0,timeout=15000)
                changed=wait_api(teacher,lambda d:any(i["id"]==obj["id"] and i["text"]=="Edited "+name and abs(i["x"]-moved["x"])<0.01 for i in d["items"]),name+" stale editor overwrote peer geometry")
                for page in (teacher,pupil):geometry_synced(page,changed["items"])
                print(name+" real modal + pupil transform passed")
                replace_items([])

            # Live physics editors commit actual controls before closing.
            # A peer transform between two nested changes must survive.
            physics_cases=[
                ("mechanics","physics-forces","scienceMechanics",{"version":1,"bodies":[],"supports":[],"forces":[],"grid":True,"labels":True},".lektrus-mechanics-layout","Названия и величины"),
                ("optics","physics-optics","scienceOptics",{"version":1,"elements":[],"rays":[],"grid":True,"labels":True,"normals":True},".lektrus-optics-layout","Подписи"),
            ]
            for name,figure,field,model,dialog,label in physics_cases:
                obj={"id":"qa-live-"+name,"kind":"graph","graphFigureId":figure,"graphPurpose":"geometry","graphAxisMode":"none","x":220,"y":160,"width":520,"height":360,"text":"QA "+name,"createdBy":author,field:model}
                replace_items([obj])
                editor=open_existing(obj,dialog)
                editor.get_by_label("Точки сетки",exact=True).uncheck()
                wait_api(teacher,lambda d:any(i["id"]==obj["id"] and i.get(field,{}).get("grid") is False for i in d["items"]),name+" live grid change not saved")
                moved=peer_move(obj)
                editor.get_by_label(label,exact=True).uncheck()
                changed=wait_api(teacher,lambda d:any(i["id"]==obj["id"] and i.get(field,{}).get("grid") is False and i.get(field,{}).get("labels") is False and abs(i["x"]-moved["x"])<0.01 for i in d["items"]),name+" live nested edit lost previous state or geometry")
                for page in (teacher,pupil):
                    page.wait_for_function("""({ident,id,field})=>{
                        const raw=localStorage.getItem("lesson-board.document.v1.board."+ident);
                        const item=raw&&JSON.parse(raw).items.find(i=>i.id===id);
                        return item?.[field]?.grid===false&&item[field].labels===false;
                    }""",arg={"ident":ident,"id":obj["id"],"field":field},timeout=15000)
                teacher.get_by_role("button",name="Закрыть редактор",exact=True).click()
                expect(editor).to_have_count(0,timeout=15000)
                for page in (teacher,pupil):geometry_synced(page,changed["items"])
                print(name+" real live nested controls, peer transform and close converged.")
                replace_items([])

            # Electrical circuit editor: its two nested settings must remain
            # independent of a pupil's concurrent change of the board pose.
            circuit={"id":"qa-live-circuit","kind":"graph","graphFigureId":"physics-circuit-free","graphPurpose":"geometry","graphAxisMode":"none","x":220,"y":160,"width":520,"height":360,"text":"QA circuit","createdBy":author,
                     "scienceCircuit":{"version":1,"components":[],"junctions":[],"wires":[],"showGrid":True,"snap":True}}
            replace_items([circuit])
            editor=open_existing(circuit,".lektrus-circuit-editor")
            editor.get_by_label("Сетка",exact=True).uncheck()
            wait_api(teacher,lambda d:any(i["id"]==circuit["id"] and i.get("scienceCircuit",{}).get("showGrid") is False for i in d["items"]),"Circuit grid not saved live")
            moved=peer_move(circuit)
            editor.get_by_label("Привязка",exact=True).uncheck()
            changed=wait_api(teacher,lambda d:any(i["id"]==circuit["id"] and i.get("scienceCircuit",{}).get("showGrid") is False and i["scienceCircuit"].get("snap") is False and abs(i["x"]-moved["x"])<0.01 for i in d["items"]),"Circuit nested settings lost peer geometry")
            for page in (teacher,pupil):
                page.wait_for_function("""({ident,id})=>{
                    const raw=localStorage.getItem("lesson-board.document.v1.board."+ident);
                    const item=raw&&JSON.parse(raw).items.find(i=>i.id===id);
                    return item?.scienceCircuit?.showGrid===false&&item.scienceCircuit.snap===false;
                }""",arg={"ident":ident,"id":circuit["id"]},timeout=15000)
            editor.get_by_role("button",name="Закрыть редактор",exact=True).click()
            expect(editor).to_have_count(0,timeout=15000)
            for page in (teacher,pupil):geometry_synced(page,changed["items"])
            print("Circuit real nested settings and concurrent pupil geometry converged.")
            replace_items([])

            # Live motion-graph editor: settings and point values must survive
            # an intervening move of the entire graph by the other role.
            motion_graph={"id":"qa-live-motion","kind":"graph","graphFigureId":"physics-motion","graphPurpose":"coordinates","graphAxisMode":"both","graphGrid":True,"graphSnap":True,"graphConnectPoints":True,"graphShowLabels":True,"graphXMin":0,"graphXMax":10,"graphYMin":0,"graphYMax":10,"graphPoints":[{"id":"qa-p1","x":1,"y":2,"label":"A"},{"id":"qa-p2","x":3,"y":4,"label":"B"}],"x":220,"y":160,"width":520,"height":360,"text":"QA motion","createdBy":author}
            replace_items([motion_graph])
            editor=open_existing(motion_graph,".lektrus-motion-editor")
            editor.get_by_label("Сетка",exact=True).uncheck()
            wait_api(teacher,lambda d:any(i["id"]==motion_graph["id"] and i.get("graphGrid") is False for i in d["items"]),"Motion graph grid not saved")
            moved=peer_move(motion_graph)
            editor.get_by_label("Значение точки 1",exact=True).fill("5")
            changed=wait_api(teacher,lambda d:any(i["id"]==motion_graph["id"] and i.get("graphGrid") is False and any(p["y"]==5 for p in i.get("graphPoints",[])) and abs(i["x"]-moved["x"])<0.01 for i in d["items"]),"Motion graph edit lost peer geometry")
            for page in (teacher,pupil):
                page.wait_for_function("""({ident,id})=>{
                    const raw=localStorage.getItem("lesson-board.document.v1.board."+ident);
                    const item=raw&&JSON.parse(raw).items.find(i=>i.id===id);
                    return item?.graphGrid===false&&item.graphPoints.some(p=>p.y===5);
                }""",arg={"ident":ident,"id":motion_graph["id"]},timeout=15000)
            editor.get_by_role("button",name="Закрыть редактор",exact=True).click()
            expect(editor).to_have_count(0,timeout=15000)
            for page in (teacher,pupil):geometry_synced(page,changed["items"])
            print("Physical motion graph real point edit and peer geometry converged.")
            replace_items([])

            # Foreign-language order was formerly local-only. Now keyboard,
            # drag and check/reset must converge on the teacher and student.
            sentence={"id":"qa-shared-sentence","kind":"graph","graphFigureId":"language-sentence-builder","graphPurpose":"geometry","graphAxisMode":"none","x":220,"y":160,"width":620,"height":340,"text":"QA sentence","createdBy":author,
                      "schoolDiagram":{"kind":"sentence-builder","title":"QA sentence","instructions":"Arrange the words","parts":[{"id":"word-a","text":"I"},{"id":"word-b","text":"read"},{"id":"word-c","text":"books"}],"showKey":False,"showHint":False,"patternId":""}}
            replace_items([sentence])
            def word_order(page):
                return page.locator("[data-sentence-word]").evaluate_all("els=>els.map(e=>e.dataset.sentenceWord)")
            def expect_order(page,order):
                page.wait_for_function("order=>JSON.stringify(Array.from(document.querySelectorAll('[data-sentence-word]'),e=>e.dataset.sentenceWord))===JSON.stringify(order)",arg=order,timeout=15000)
            expect(pupil.locator("[data-sentence-word]").first).to_be_visible()
            initial=word_order(pupil)
            pupil.locator("[data-sentence-word]").first.press("End")
            arranged=initial[1:]+initial[:1]
            wait_api(pupil,lambda d:any(i["id"]==sentence["id"] and i.get("schoolDiagram",{}).get("answerOrder")==arranged for i in d["items"]),"Student word order not saved")
            expect_order(teacher,arranged);expect_order(pupil,arranged)
            pupil.get_by_role("button",name="Проверить",exact=True).click()
            wait_api(pupil,lambda d:any(i["id"]==sentence["id"] and i.get("schoolDiagram",{}).get("answerChecked") is True for i in d["items"]),"Student word check not saved")
            expect(teacher.locator(".lektrus-sentence-status")).to_contain_text(re.compile("Правильно|Есть неточности"),timeout=15000)
            # Try forging both the source text and an invalid duplicate order.
            row=client.get(url).json()
            for mutation in ("source","duplicates"):
                forged=json.loads(json.dumps(row["document"]))
                d=forged["items"][0]["schoolDiagram"]
                if mutation=="source":d["parts"][0]["text"]="forged"
                else:d["answerOrder"]=["word-a","word-a","word-c"]
                with httpx.Client(base_url=API,headers=headers("learner")) as learner:
                    rejected=learner.put(url,json={"expected_version":row["version"],"document":forged})
                    assert rejected.status_code==403,(mutation,rejected.status_code,rejected.text)
            teacher.get_by_role("button",name="Заново",exact=True).click()
            expect_order(pupil,initial)
            wait_api(teacher,lambda d:any(i["id"]==sentence["id"] and i.get("schoolDiagram",{}).get("answerOrder")==initial and i["schoolDiagram"].get("answerChecked") is False for i in d["items"]),"Sentence reset not saved")
            print("Shared sentence keyboard order, check, reset and forged student structure denied.")
            replace_items([])

            # Shared geography, capitals avoid external image dependencies.
            geo={"id":"qa-shared-geo","kind":"graph","graphFigureId":"geo-matching","graphPurpose":"geometry","graphAxisMode":"none","x":160,"y":100,"width":680,"height":320,"text":"QA geography","createdBy":author,
                 "schoolDiagram":{"kind":"geo-training","title":"QA geography","exercise":"matching","relation":"country-capital","reverse":False,"countryCodes":["FR","RU"]}}
            replace_items([geo])
            expect(pupil.locator(".lektrus-geo-match-item").first).to_be_visible()
            pupil.locator(".lektrus-geo-match-grid section").nth(0).get_by_role("button").first.click()
            expect(teacher.locator(".lektrus-geo-match-grid section").nth(0).get_by_role("button").first).to_have_attribute("aria-pressed","true",timeout=15000)
            pupil.locator(".lektrus-geo-match-grid section").nth(1).get_by_role("button").nth(1).click()
            wait_api(pupil,lambda d:any(i["id"]==geo["id"] and i.get("schoolDiagram",{}).get("practice",{}).get("matched")==["FR"] for i in d["items"]),"Geography pair not saved")
            expect(teacher.locator(".lektrus-geo-game-progress")).to_contain_text("1 / 2",timeout=15000)
            teacher.get_by_role("button",name="↻ Заново",exact=True).click()
            expect(pupil.locator(".lektrus-geo-game-progress")).to_contain_text("0 / 2",timeout=15000)
            replace_items([])
            geo={**geo,"id":"qa-shared-geo-cards","graphFigureId":"geo-question-cards","schoolDiagram":{**geo["schoolDiagram"],"exercise":"cards"}}
            replace_items([geo])
            pupil.get_by_role("button",name="Показать ответ",exact=True).click()
            expect(teacher.get_by_role("button",name="Скрыть ответ",exact=True)).to_be_visible(timeout=15000)
            pupil.get_by_role("button",name="✓ Знаю",exact=True).click()
            wait_api(pupil,lambda d:any(i["id"]==geo["id"] and i.get("schoolDiagram",{}).get("practice",{}).get("known")==["RU"] for i in d["items"]),"Geography card rating not saved")
            expect(teacher.locator(".lektrus-geo-game-progress")).to_contain_text("1 / 2",timeout=15000)
            row=client.get(url).json()
            forged=json.loads(json.dumps(row["document"]))
            forged["items"][0]["schoolDiagram"]["practice"]["known"]=["US"]
            with httpx.Client(base_url=API,headers=headers("learner")) as learner:
                rejected=learner.put(url,json={"expected_version":row["version"],"document":forged})
                assert rejected.status_code==403,(rejected.status_code,rejected.text)
            print("Shared geography matching selection/pair/reset and card reveal/rating converged; forged answer denied.")
            replace_items([])

            # Standalone vocabulary and spelling must also converge.
            vocab={"id":"qa-vocabulary","kind":"graph","graphFigureId":"language-flashcards","graphPurpose":"geometry","graphAxisMode":"none","x":160,"y":100,"width":620,"height":340,"text":"QA vocabulary","createdBy":author,
                   "schoolDiagram":{"kind":"flashcards","title":"QA vocabulary","cards":[{"id":"one","term":"Hello","translation":"Привет","transcription":""},{"id":"two","term":"Book","translation":"Книга","transcription":""}],"showTranslation":False,"showTranscription":False,"direction":"foreign-first"}}
            replace_items([vocab])
            pupil.get_by_role("button",name="Перевернуть карточку",exact=True).click()
            wait_api(pupil,lambda d:any(i["id"]==vocab["id"] and i.get("schoolDiagram",{}).get("response")=={"index":0,"revealed":True} for i in d["items"]),"Vocabulary response not saved")
            expect(teacher.locator(".lektrus-flashcard-word")).to_have_text("Привет",timeout=15000)
            teacher.get_by_role("button",name="Следующая карточка",exact=True).click()
            expect(pupil.locator(".lektrus-flashcard-word")).to_have_text("Book",timeout=15000)
            replace_items([])
            spelling={"id":"qa-spelling","kind":"graph","graphFigureId":"ru-orthography","graphPurpose":"geometry","graphAxisMode":"none","x":160,"y":100,"width":620,"height":340,"text":"QA spelling","createdBy":author,
                      "schoolDiagram":{"kind":"orthography","title":"QA spelling","questions":[{"id":"one","prompt":"л□с","options":["е","и"],"correct":0,"explanation":"Лес"},{"id":"two","prompt":"м□р","options":["и","е"],"correct":0,"explanation":""}],"showExplanation":True}}
            replace_items([spelling])
            pupil.locator(".lektrus-orthography-answers").get_by_role("button",name="е",exact=True).click()
            expect(teacher.locator(".lektrus-orthography-gap")).to_have_text("е",timeout=15000)
            pupil.get_by_role("button",name="Проверить",exact=True).click()
            wait_api(pupil,lambda d:any(i["id"]==spelling["id"] and i.get("schoolDiagram",{}).get("response")=={"index":0,"picked":0,"checked":True} for i in d["items"]),"Orthography response not saved")
            expect(teacher.locator(".lektrus-orthography-feedback")).to_contain_text("Верно!",timeout=15000)
            row=client.get(url).json()
            for mutation in ("source","index","picked"):
                forged=json.loads(json.dumps(row["document"]))
                diagram=forged["items"][0]["schoolDiagram"]
                if mutation=="source":diagram["questions"][0]["correct"]=1
                elif mutation=="index":diagram["response"]["index"]=9
                else:diagram["response"]["picked"]=9
                with httpx.Client(base_url=API,headers=headers("learner")) as learner:
                    rejected=learner.put(url,json={"expected_version":row["version"],"document":forged})
                    assert rejected.status_code==403,(mutation,rejected.status_code,rejected.text)
            teacher.get_by_role("button",name="Дальше →",exact=True).click()
            expect(pupil.locator(".lektrus-orthography-count")).to_have_text("Задание 2 из 2",timeout=15000)
            print("Shared vocabulary and orthography responses, navigation and forged response denial passed.")
            replace_items([])

            # Syntax annotations and number-base answers share the same board.
            syntax={"id":"qa-syntax","kind":"graph","graphFigureId":"ru-syntax","graphPurpose":"geometry","graphAxisMode":"none","x":160,"y":100,"width":620,"height":340,"text":"QA syntax","createdBy":author,
                    "schoolDiagram":{"kind":"syntax","title":"QA syntax","showMarks":True,"words":[{"id":"a","text":"Мама","role":"none"},{"id":"b","text":"читает","role":"none"}]}}
            replace_items([syntax])
            pupil.get_by_role("button",name="Мама: Не отмечать",exact=True).click()
            wait_api(pupil,lambda d:any(i["id"]==syntax["id"] and i.get("schoolDiagram",{}).get("words",[{}])[0].get("role")=="subject" for i in d["items"]),"Syntax mark not saved")
            expect(teacher.get_by_role("button",name="Мама: Подлежащее",exact=True)).to_be_visible(timeout=15000)
            teacher.get_by_label("Выберите член предложения",exact=True).select_option("predicate")
            teacher.get_by_role("button",name="читает: Не отмечать",exact=True).click()
            expect(pupil.get_by_role("button",name="читает: Сказуемое",exact=True)).to_be_visible(timeout=15000)
            row=client.get(url).json()
            forged=json.loads(json.dumps(row["document"]))
            forged["items"][0]["schoolDiagram"]["words"][0]["text"]="Подмена"
            with httpx.Client(base_url=API,headers=headers("learner")) as learner:
                rejected=learner.put(url,json={"expected_version":row["version"],"document":forged})
                assert rejected.status_code==403,(rejected.status_code,rejected.text)
            replace_items([])
            place={"id":"qa-place-value","kind":"graph","graphFigureId":"info-place-value","graphPurpose":"geometry","graphAxisMode":"none","x":160,"y":100,"width":620,"height":340,"text":"QA base","createdBy":author,
                   "schoolDiagram":{"kind":"place-value","title":"QA base","base":2,"digits":"","showPowers":True}}
            replace_items([place])
            pupil.get_by_placeholder("Введите число",exact=True).fill("101")
            wait_api(pupil,lambda d:any(i["id"]==place["id"] and i.get("schoolDiagram",{}).get("digits")=="101" for i in d["items"]),"Place-value response not saved")
            expect(teacher.get_by_placeholder("Введите число",exact=True)).to_have_value("101",timeout=15000)
            row=client.get(url).json()
            forged=json.loads(json.dumps(row["document"]))
            forged["items"][0]["schoolDiagram"]["base"]=16
            with httpx.Client(base_url=API,headers=headers("learner")) as learner:
                rejected=learner.put(url,json={"expected_version":row["version"],"document":forged})
                assert rejected.status_code==403,(rejected.status_code,rejected.text)
            teacher.get_by_label("Основание",exact=True).select_option("10")
            expect(pupil.get_by_placeholder("Введите число",exact=True)).to_have_value("",timeout=15000)
            expect(pupil.get_by_text("Основание: 10",exact=True)).to_be_visible(timeout=15000)
            pupil.get_by_placeholder("Введите число",exact=True).fill("98")
            expect(teacher.get_by_placeholder("Введите число",exact=True)).to_have_value("98",timeout=15000)
            print("Shared syntax marks, place-value input, teacher base replacement and forged source denial passed.")
            replace_items([])

            # Save on an open chart after a co-teacher deletes it: do not
            # reinterpret the absent existing object as a new draft.
            chart={"id":"qa-deleted-chart","kind":"graph","graphFigureId":"lektrus-chart","chartStyle":"bar","chartEntries":[{"label":"A","value":1}],
                   "x":220,"y":160,"width":520,"height":360,"text":"Delete race","createdBy":author}
            replace_items([chart])
            editor=open_existing(chart,".lektrus-data-chart-dialog")
            editor.locator('input[placeholder="Название диаграммы"]').fill("Must not reappear")
            row=client.get(url).json()
            with httpx.Client(base_url=API,headers=headers("colleague")) as other:
                other.patch(url,json={"expected_version":row["version"],"delta":{"items":{"remove":[chart["id"]]}}}).raise_for_status()
            both(chart["id"],False)
            editor.locator(".primary").click()
            teacher.wait_for_timeout(1000)
            assert not any(i["id"]==chart["id"] for i in read()["items"]),"Deleted chart resurrected on Save"
            print("Detached subject editor save-after-delete denied in real browser.")

            # Real teacher-side creation, peer display, student answers and
            # teacher deletion, rather than just sending a JSON fixture.
            for shortcut,kind in (("f","frame"),("b","table"),("x","formula"),("k","checklist"),
                                  ("g","quiz"),("j","flashcard"),("u","cover"),("l","linkmedia"),("c","connector"),("y","graph")):
                replace_items([])
                teacher.locator('[data-interface-control="select"]:visible').first.click()
                teacher.keyboard.press(shortcut)
                expect(teacher.locator("section.board")).to_have_class(re.compile(r"\bboard-tool-"+kind+r"\b"))
                box=teacher.locator("section.board").bounding_box()
                x=box["x"]+box["width"]*.58;y=box["y"]+box["height"]*.48
                if kind=="connector":
                    teacher.mouse.move(x-100,y);teacher.mouse.down();teacher.mouse.move(x+100,y+40,steps=12);teacher.mouse.up()
                else:teacher.mouse.click(x,y)
                if kind=="frame":
                    field=teacher.locator('textarea[aria-label="Текст объекта"]');expect(field).to_be_visible();field.fill("QA frame");field.press("Control+Enter")
                elif kind=="table":
                    dialog=teacher.locator(".table-editor-modal");expect(dialog).to_be_visible()
                    dialog.locator(".table-editor-grid textarea").first.fill("First live cell")
                    row=wait_api(teacher,lambda d:any(i["kind"]=="table" for i in d["items"]),"Table creation not saved")
                    table=next(i for i in row["items"] if i["kind"]=="table")
                    target=pupil.locator(f'.board-object[data-object="{table["id"]}"]')
                    expect(target).to_contain_text("First live cell",timeout=15000)
                    peer_move(table)
                    dialog.locator(".table-editor-grid textarea").nth(1).fill("Second live cell")
                    expect(target).to_contain_text("First live cell",timeout=15000)
                    expect(target).to_contain_text("Second live cell",timeout=15000)
                    dialog.locator(".table-editor-footer .primary").click()
                elif kind=="formula":
                    teacher.locator("#formula-source").fill("x^2+1")
                    teacher.locator(".formula-editor-footer .primary").click()
                elif kind=="checklist":
                    dialog=teacher.locator(".checklist-editor-modal");dialog.locator(".checklist-title-input input").fill("QA checklist")
                    dialog.locator('.checklist-editor-row input[placeholder="Пункт 1"]').fill("QA task")
                    dialog.locator(".checklist-editor-footer .primary").click()
                elif kind=="quiz":
                    dialog=teacher.locator(".quiz-editor-modal");dialog.locator('textarea[placeholder="Введите вопрос…"]').fill("QA quiz")
                    dialog.locator('input[placeholder="Вариант A"]').fill("A");dialog.locator('input[placeholder="Вариант B"]').fill("B")
                    dialog.locator(".quiz-editor-footer .primary").click()
                elif kind=="flashcard":
                    dialog=teacher.locator(".flashcard-editor-modal");dialog.locator("textarea").nth(0).fill("QA front");dialog.locator("textarea").nth(1).fill("QA back")
                    dialog.locator(".flashcard-editor-footer .primary").click()
                elif kind=="linkmedia":
                    teacher.locator(".link-media-dialog input").first.fill("https://example.test/video")
                    teacher.locator(".link-media-dialog input").nth(1).fill("QA link")
                    teacher.locator(".link-media-dialog .boards-create").click()
                elif kind=="graph":
                    teacher.locator(".lektrus-graph-footer .primary").click()
                row=wait_api(teacher,lambda d:any(i["kind"]==kind for i in d["items"]),kind+" UI creation not saved")
                obj=next(i for i in row["items"] if i["kind"]==kind)
                selector=f'.board-object[data-object="{obj["id"]}"]'
                expect(pupil.locator(selector)).to_be_visible(timeout=15000)
                if kind in ("checklist","quiz","flashcard","cover"):
                    control,field,value={
                        "checklist":(".checklist-box","checklistDone",[True]),
                        "quiz":(".quiz-option","quizSelected",0),
                        "flashcard":(".flashcard-flip-button","flashcardFlipped",True),
                        "cover":(".cover-toggle","coverOpen",True)
                    }[kind]
                    # The cover toggle is intentionally teacher-only in the UI.
                    actor,receiver=(teacher,pupil) if kind=="cover" else (pupil,teacher)
                    actor.locator(selector+" "+control).first.click()
                    wait_api(actor,lambda d:any(i["id"]==obj["id"] and i.get(field)==value for i in d["items"]),kind+" response did not synchronize")
                    receiver.wait_for_function("""({ident,id,field,value})=>{
                        const raw=localStorage.getItem('lesson-board.document.v1.board.'+ident);
                        const item=raw&&JSON.parse(raw).items.find(i=>i.id===id);
                        return !!item&&JSON.stringify(item[field])===JSON.stringify(value);
                    }""",arg={"ident":ident,"id":obj["id"],"field":field,"value":value},timeout=15000)
                # Reopen existing structural editors, not just initial creation.
                # Hold a draft while the pupil moves the same object.
                edit_cases={
                    "formula":("Редактировать формулу","#formula-source",".formula-editor-footer .primary","x^3+2","text"),
                    "checklist":("Редактировать чек-лист",".checklist-title-input input",".checklist-editor-footer .primary","Edited checklist","text"),
                    "quiz":("Редактировать мини-тест",'textarea[placeholder="Введите вопрос…"]',".quiz-editor-footer .primary","Edited quiz","text"),
                    "flashcard":("Редактировать карточку",".flashcard-editor-modal textarea:first-of-type",".flashcard-editor-footer .primary","Edited front","text"),
                    "linkmedia":("Изменить ссылку",".link-media-dialog input:nth-of-type(1)",".link-media-dialog .boards-create","https://example.test/changed","mediaUrl"),
                }
                if kind in edit_cases:
                    title,field,save,value,key=edit_cases[kind]
                    select_all(teacher)
                    teacher.locator(f'button[title="{title}"]:visible').first.click()
                    control=teacher.locator(field).first
                    expect(control).to_be_visible()
                    control.fill(value)
                    current=next(i for i in read()["items"] if i["id"]==obj["id"])
                    moved=peer_move(current)
                    teacher.locator(save).click()
                    edited=wait_api(teacher,lambda d:any(i["id"]==obj["id"] and i.get(key)==value and abs(i["x"]-moved["x"])<.01 for i in d["items"]),kind+" existing draft lost content or peer geometry")
                    for page in (teacher,pupil):
                        geometry_synced(page,edited["items"])
                        page.wait_for_function("""({ident,id,key,value})=>{
                            const raw=localStorage.getItem("lesson-board.document.v1.board."+ident);
                            const item=raw&&JSON.parse(raw).items.find(i=>i.id===id);
                            return item?.[key]===value;
                        }""",arg={"ident":ident,"id":obj["id"],"key":key,"value":value},timeout=15000)
                    obj=next(i for i in edited["items"] if i["id"]==obj["id"])
                    print(kind+" existing editor save preserved peer geometry.")
                # Exercise allowed positioning, resize and rotation in the opposite role.
                moved_obj=peer_move(obj)
                if kind!="connector":peer_resize_rotate(moved_obj)
                else:
                    select_all(pupil)
                    endpoint=pupil.locator("[data-connector-endpoint=end]:visible").first
                    expect(endpoint).to_be_visible(timeout=10000)
                    rect=endpoint.bounding_box();x=rect["x"]+rect["width"]/2;y=rect["y"]+rect["height"]/2
                    pupil.mouse.move(x,y);pupil.mouse.down()
                    try:pupil.mouse.move(x+30,y+20,steps=5)
                    finally:pupil.mouse.up()
                    changed=wait_api(pupil,lambda d:any(i["id"]==obj["id"] and (abs(i["width"]-moved_obj["width"])>2 or abs(i["height"]-moved_obj["height"])>2) for i in d["items"]),"Connector endpoint not saved")
                    for page in (teacher,pupil):geometry_synced(page,changed["items"])
                select_all(teacher);teacher.keyboard.press("Delete")
                wait_api(teacher,lambda d:not any(i["id"]==obj["id"] for i in d["items"]),kind+" UI deletion not saved")
                expect(pupil.locator(selector)).to_have_count(0,timeout=15000)
                print(kind+" real UI create/peer display/allowed response/peer move/delete passed.")

            # Create the fraction via the actual subject catalogue, not only
            # the previously seeded detached-editor fixture.
            replace_items([])
            teacher.locator('button[aria-label="Предметные инструменты"]:visible').first.click()
            subject=teacher.get_by_role("combobox",name="Предмет доски для набора инструментов")
            math_option=subject.locator("option").filter(has_text=re.compile(r"^математика$",re.I)).first
            subject.select_option(value=math_option.get_attribute("value"))
            teacher.get_by_role("button",name="Дроби",exact=True).click()
            fraction_dialog=teacher.locator(".lektrus-fraction-dialog")
            expect(fraction_dialog).to_be_visible()
            fraction_dialog.locator(".lektrus-fraction-fields > label:first-child input").fill("QA fraction")
            fraction_dialog.locator(".primary").click()
            fraction_row=wait_api(teacher,lambda d:any(i["kind"]=="fraction" and i["text"]=="QA fraction" for i in d["items"]),"Fraction UI creation not saved")
            fraction=next(i for i in fraction_row["items"] if i["kind"]=="fraction")
            both(fraction["id"])
            expect(pupil.locator(f'.board-object[data-object="{fraction["id"]}"]')).to_contain_text("QA fraction")
            select_all(teacher)
            teacher.locator('button[title="Редактировать дробь"]:visible').first.click()
            fraction_dialog.get_by_label("Знаменатель",exact=True).fill("8")
            moved=peer_move(fraction)
            fraction_dialog.locator(".primary").click()
            edited=wait_api(teacher,lambda d:any(i["id"]==fraction["id"] and i.get("fractionDenominator")==8 and abs(i["x"]-moved["x"])<.01 for i in d["items"]),"Fraction denominator or peer movement lost")
            fraction=next(i for i in edited["items"] if i["id"]==fraction["id"])
            peer_resize_rotate(peer_move(fraction))
            select_all(teacher);teacher.keyboard.press("Delete")
            both(fraction["id"],False)
            print("Fraction created through subject catalogue, peer movement and deletion passed.")

            # Comments are a legacy persisted item kind: creation tool was
            # intentionally removed, but old comments must remain editable.
            comment={"id":"qa-legacy-comment","kind":"comment","x":220,"y":160,"width":300,"height":150,"text":"Legacy comment","createdBy":author,"resolved":False}
            replace_items([comment])
            selector='.board-object[data-object="qa-legacy-comment"]'
            teacher.locator('[data-interface-control="select"]:visible').first.click()
            teacher.locator(selector).dblclick()
            field=teacher.locator('textarea[aria-label="Текст объекта"]')
            expect(field).to_be_visible();field.fill("Edited legacy comment");field.press("Control+Enter")
            wait_api(teacher,lambda d:any(i["id"]==comment["id"] and i["text"]=="Edited legacy comment" for i in d["items"]),"Legacy comment edit not saved")
            expect(pupil.locator(selector)).to_contain_text("Edited legacy comment")
            select_all(teacher)
            teacher.locator('button[title="Отметить комментарий решённым"]:visible').first.click()
            wait_api(teacher,lambda d:any(i["id"]==comment["id"] and i.get("resolved") is True for i in d["items"]),"Legacy comment resolution not saved")
            expect(pupil.locator(selector)).to_contain_text("Решено")
            select_all(teacher);teacher.keyboard.press("Delete")
            both(comment["id"],False)
            print("Legacy persisted comment edit, resolve and deletion converged.")

            # Actual ruler, set square and protractor creation, live move,
            # scale adjustment and deletion by both editing roles.
            for actor,receiver in ((teacher,pupil),(pupil,teacher)):
                for label,kind in (("Линейка","ruler"),("Угольник","triangle"),("Транспортир","protractor")):
                    replace_items([])
                    actor.locator('button[aria-label="Добавить измерительный инструмент"]:visible').first.click()
                    actor.get_by_role("button",name="Добавить: "+label,exact=True).click()
                    row=wait_api(actor,lambda d:any(i["kind"]=="instrument" and i.get("instrumentType")==kind for i in d["items"]),kind+" instrument missing")
                    obj=next(i for i in row["items"] if i["kind"]=="instrument")
                    selector=f'[data-shared-instrument="{obj["id"]}"]'
                    body=selector+" .geometry-instrument-body"
                    # The portal anchor intentionally has zero area. Its transformed
                    # body is the actual visible and interactive instrument.
                    for page in (actor,receiver):expect(page.locator(body)).to_be_visible(timeout=15000)
                    target=actor.locator(body)
                    box=target.bounding_box()
                    before=receiver.locator(body).bounding_box()
                    x=box["x"]+box["width"]/2;y=box["y"]+box["height"]/2
                    actor.mouse.move(x,y);actor.mouse.down()
                    try:
                        actor.mouse.move(x+70,y+30,steps=8)
                        receiver.wait_for_function("""({selector,x,y})=>{
                            const e=document.querySelector(selector);if(!e)return false;
                            const b=e.getBoundingClientRect();return Math.hypot(b.x-x,b.y-y)>20;
                        }""",arg={"selector":body,"x":before["x"],"y":before["y"]},timeout=5000)
                    finally:actor.mouse.up()
                    moved=wait_api(actor,lambda d:any(i["id"]==obj["id"] and abs(i["x"]-obj["x"])>20 for i in d["items"]),kind+" move not saved")
                    for page in (actor,receiver):geometry_synced(page,moved["items"])
                    def rendered_scale(page):
                        return page.locator(body).evaluate("e=>{const m=new DOMMatrix(getComputedStyle(e).transform);return Math.hypot(m.a,m.b)}")
                    initial_scales=[rendered_scale(page) for page in (actor,receiver)]
                    actor.locator(selector+' button[aria-label="Уменьшить инструмент"]').click()
                    scaled=wait_api(actor,lambda d:any(i["id"]==obj["id"] and i["instrumentScale"]<obj["instrumentScale"] for i in d["items"]),kind+" scale not saved")
                    expected_scale=next(i["instrumentScale"] for i in scaled["items"] if i["id"]==obj["id"])
                    for page,initial_scale in zip((actor,receiver),initial_scales):
                        page.wait_for_function("""({body,target})=>{
                            const e=document.querySelector(body);if(!e)return false;
                            const m=new DOMMatrix(getComputedStyle(e).transform);
                            return Math.abs(Math.hypot(m.a,m.b)-target)<0.02;
                        }""",arg={"body":body,"target":initial_scale*expected_scale/obj["instrumentScale"]},timeout=15000)
                        page.wait_for_function("""({ident,id,scale})=>{
                            const raw=localStorage.getItem("lesson-board.document.v1.board."+ident);
                            return !!raw&&JSON.parse(raw).items.some(i=>i.id===id&&Math.abs(i.instrumentScale-scale)<0.001);
                        }""",arg={"ident":ident,"id":obj["id"],"scale":expected_scale},timeout=15000)
                    # Rotate through the actual instrument-specific control, then reset.
                    rotation=actor.locator(selector+' button[aria-label="Повернуть инструмент"]')
                    rect=rotation.bounding_box();x=rect["x"]+rect["width"]/2;y=rect["y"]+rect["height"]/2
                    actor.mouse.move(x,y);actor.mouse.down()
                    try:actor.mouse.move(x+60,y+30,steps=6)
                    finally:actor.mouse.up()
                    rotated=wait_api(actor,lambda d:any(i["id"]==obj["id"] and abs(i.get("rotation",0))>5 for i in d["items"]),kind+" instrument rotation not saved")
                    for page in (actor,receiver):geometry_synced(page,rotated["items"])
                    actor.locator(selector+' button[aria-label="Сбросить угол"]').click()
                    reset=wait_api(actor,lambda d:any(i["id"]==obj["id"] and abs(i.get("rotation",0))<.01 for i in d["items"]),kind+" instrument reset not saved")
                    for page in (actor,receiver):geometry_synced(page,reset["items"])
                    actor.locator(selector+' button[aria-label="Убрать инструмент"]').click()
                    wait_api(actor,lambda d:not any(i["id"]==obj["id"] for i in d["items"]),kind+" instrument deletion not saved")
                    expect(receiver.locator(selector)).to_have_count(0,timeout=15000)
                    print(kind+" creation/motion/scale/deletion by "+("teacher" if actor is teacher else "student")+" passed")

            # Minimal valid two-page PDF with real xref and different colored
            # page content. No external files or network are needed.
            def make_pdf():
                streams=[b"0.1 0.4 0.8 rg 10 10 180 180 re f",b"0.8 0.2 0.1 rg 10 10 180 180 re f"]
                objects=[b"<< /Type /Catalog /Pages 2 0 R >>",
                         b"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
                         b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 5 0 R >>",
                         b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 6 0 R >>"]
                objects += [b"<< /Length "+str(len(stream)).encode()+b" >>\nstream\n"+stream+b"\nendstream" for stream in streams]
                out=b"%PDF-1.4\n";offsets=[0]
                for index,obj in enumerate(objects,1):
                    offsets.append(len(out));out+=str(index).encode()+b" 0 obj\n"+obj+b"\nendobj\n"
                xref=len(out)
                out+=b"xref\n0 "+str(len(offsets)).encode()+b"\n0000000000 65535 f \n"
                out+=b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
                return out+b"trailer\n<< /Size "+str(len(offsets)).encode()+b" /Root 1 0 R >>\nstartxref\n"+str(xref).encode()+b"\n%%EOF\n"
            replace_items([])
            pupil.locator('input[aria-label="Добавить фото или PDF"]').set_input_files({"name":"qa-two-pages.pdf","mimeType":"application/pdf","buffer":make_pdf()})
            expect(pupil.locator(".student-media-pending")).to_be_visible(timeout=30000)
            expect(teacher.locator(".teacher-media-request-head")).to_contain_text("qa-two-pages.pdf",timeout=30000)
            teacher.locator(".teacher-media-request-actions button.approve").click()
            row=wait_api(teacher,lambda d:any(i["kind"]=="pdf" and i.get("name")=="qa-two-pages.pdf" for i in d["items"]),"Approved PDF never committed")
            pdf=next(i for i in row["items"] if i["kind"]=="pdf")
            both(pdf["id"])
            for page in (teacher,pupil):expect(page.locator(f'.board-object[data-object="{pdf["id"]}"]')).to_be_visible(timeout=30000)
            select_all(pupil)
            next_page=pupil.get_by_role("button",name="Следующая страница PDF",exact=True)
            expect(next_page).to_be_enabled(timeout=30000);next_page.click()
            wait_api(pupil,lambda d:any(i["id"]==pdf["id"] and i.get("pdfPage")==2 for i in d["items"]),"PDF page change not saved")
            select_all(teacher)
            expect(teacher.get_by_role("spinbutton",name="Номер страницы PDF")).to_have_value("2",timeout=30000)
            teacher.get_by_role("button",name="Предыдущая страница PDF",exact=True).click()
            wait_api(teacher,lambda d:any(i["id"]==pdf["id"] and i.get("pdfPage")==1 for i in d["items"]),"Teacher PDF page change not saved")
            expect(pupil.get_by_role("spinbutton",name="Номер страницы PDF")).to_have_value("1",timeout=30000)
            moved_pdf=peer_move(pdf)
            peer_resize_rotate(moved_pdf)
            select_all(teacher)
            teacher.get_by_role("button",name="Добавить следующую страницу PDF рядом",exact=True).click()
            copies=wait_api(teacher,lambda d:len([i for i in d["items"] if i["kind"]=="pdf"])==2,"PDF page copy not saved")
            copy=next(i for i in copies["items"] if i["id"]!=pdf["id"])
            assert copy["assetId"]==pdf["assetId"] and copy["pdfPage"]==2
            both(copy["id"])
            for page in (teacher,pupil):geometry_synced(page,copies["items"])
            select_all(teacher);teacher.keyboard.press("Delete")
            both(pdf["id"],False);both(copy["id"],False)
            print("Real two-page PDF upload, durable teacher approval, bidirectional pagination, movement and deletion passed.")

            # Change only the wall-clock read, not Chromium timers. Installing
            # a fake timer scheduler after the board mounted can invalidate
            # existing heartbeat/expiry timers. Actual socket and API remain real.
            replace_items([])
            pupil.bring_to_front()
            pupil.evaluate("""()=>{
                window.__qaRealNow=Date.now;
                window.__qaClockOffset=0;
                Date.now=()=>window.__qaRealNow()+window.__qaClockOffset;
            }""")
            def visibility(hidden):
                pupil.evaluate("""hidden=>{
                    Object.defineProperty(document,"hidden",{configurable:true,get:()=>hidden});
                    Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>hidden?"hidden":"visible"});
                    document.dispatchEvent(new Event("visibilitychange"));
                }""",hidden)
            indicator=pupil.locator(".lektrus-board-idle-indicator")
            try:
                expect(indicator).to_have_count(0,timeout=15000)
                pupil.wait_for_timeout(500)
                initial_sockets=len(pupil_sockets)
                assert initial_sockets>0
                visibility(True)
                # Advance wall time but not timers: like an OS suspending a
                # WebView for just under ten minutes.
                pupil.evaluate("window.__qaClockOffset=590000")
                visibility(False)
                pupil.evaluate("window.__qaClockOffset=0")
                expect(indicator).to_have_count(0,timeout=10000)
                assert len(pupil_sockets)==initial_sockets,("Short background visit unnecessarily replaced the board socket",pupil_lifecycle[-12:])
                assert any(n==initial_sockets and t=="activity" and bg is True and age is not None and age<1000 for n,t,bg,age in pupil_lifecycle),"Short visit did not notify server of background"
                first_after_short=draw(pupil,"pen",.65)
                both(first_after_short)
                assert len(pupil_sockets)==initial_sockets,"First input after short background visit reconnected the socket"
                print("Browser background below 10 minutes: same socket, immediate first stroke, both copies converged.")

                visibility(True)
                # Advance browser wall time beyond the limit. Negotiate a
                # near-expired real server lease through the test proxy, so
                # the actual 4410 close arrives without a ten-minute wait.
                # This tests the browser on the server-driven idle path.
                pupil.evaluate("window.__qaClockOffset=601000")
                pupil_sockets[-1][1].send(json.dumps({"type":"activity","idle_age_ms":599000,"background":True}))
                expect(indicator).to_contain_text("Соединение приостановлено",timeout=15000)
                asleep_sockets=len(pupil_sockets)
                missed=draw(teacher,"marker",.37)
                stored(teacher,missed)
                assert not pupil.evaluate("""({ident,id})=>{
                    const raw=localStorage.getItem("lesson-board.document.v1.board."+ident);
                    return !!raw&&JSON.parse(raw).items.some(i=>i.id===id);
                }""",{"ident":ident,"id":missed}),"Suspended board unexpectedly received a durable revision"
                assert len(pupil_sockets)==asleep_sockets,"Suspended board opened a new socket"
                visibility(False)
                pupil.evaluate("window.__qaClockOffset=0")
                # No click or reload: foreground alone must recover the missed revision.
                expect(indicator).to_have_count(0,timeout=30000)
                both(missed)
                first_after_long=draw(pupil,"pen",.77)
                both(first_after_long)
                assert len(pupil_sockets)>asleep_sockets,"Expired background lease did not establish a fresh socket"
                print("Browser background above 10 minutes: suspended, missed revision recovered on foreground, first new stroke converged.")
            finally:
                pupil.evaluate("""()=>{delete document.hidden;delete document.visibilityState;
                    Date.now=window.__qaRealNow;delete window.__qaRealNow;delete window.__qaClockOffset;}""")

            # Real authenticated Chromium touch events through the landscape
            # phone/tablet board iframe, not JS calls to React handlers.
            replace_items([])
            touch_contexts=[]
            try:
                mobile_pages=[]
                for source,size,can_author in ((pupil,{"width":844,"height":390},False),(teacher,{"width":1024,"height":768},True)):
                    mobile=browser.new_context(storage_state=source.context.storage_state(),viewport=size,has_touch=True,is_mobile=True,service_workers="block")
                    touch_contexts.append(mobile)
                    phone=mobile.new_page()
                    scope=assert_board(phone,ident,can_author,can_author,embedded=True)
                    assert_role_toolbar(scope,True,can_author,touch=True)
                    mobile_pages.append((mobile,phone,scope))
                def touch_draw(entry,kind,vertical):
                    mobile,page,scope=entry
                    scope.locator(f'[data-interface-control="{kind}"]:visible').first.tap()
                    box=scope.locator("section.board").bounding_box()
                    x=box["x"]+box["width"]*.52;y=box["y"]+box["height"]*vertical
                    before=ids(read())
                    cdp=mobile.new_cdp_session(page)
                    def event(kind,points):
                        cdp.send("Input.dispatchTouchEvent",{"type":kind,"touchPoints":points})
                    event("touchStart",[{"x":x,"y":y}])
                    try:
                        for n in range(1,9):event("touchMove",[{"x":x+n*8,"y":y+3}])
                        saved=wait_api(page,lambda d:any(i["id"] not in before and i["kind"]==kind and i.get("width",0)>25 for i in d["items"]),"Touch ink not saved while held")
                        stroke=next(i for i in saved["items"] if i["id"] not in before and i["kind"]==kind)
                    finally:
                        event("touchEnd",[]);cdp.detach()
                    for _,peer,peer_scope in mobile_pages:
                        peer_scope.locator("section.board").evaluate("""(el,{ident,id})=>new Promise((resolve,reject)=>{
                            const deadline=Date.now()+15000;
                            const check=()=>{const raw=localStorage.getItem("lesson-board.document.v1.board."+ident);
                                if(raw&&JSON.parse(raw).items.some(i=>i.id===id)){resolve(true);return}
                                if(Date.now()>deadline){reject(Error("Touch peer did not receive stroke"));return}
                                setTimeout(check,100)};check()
                        })""",{"ident":ident,"id":stroke["id"]})
                    both(stroke["id"])
                    return stroke["id"]
                a=touch_draw(mobile_pages[0],"pen",.43)
                b=touch_draw(mobile_pages[1],"marker",.63)
                desktop_id=draw(teacher,"pen",.79)
                for _,peer,scope in mobile_pages:
                    scope.locator("section.board").evaluate("""(el,{ident,ids})=>new Promise((resolve,reject)=>{
                        const deadline=Date.now()+15000;const check=()=>{
                            const raw=localStorage.getItem("lesson-board.document.v1.board."+ident);
                            if(raw&&ids.every(id=>JSON.parse(raw).items.some(i=>i.id===id))){resolve(true);return}
                            if(Date.now()>deadline){reject(Error("Cross device revision missing"));return}
                            setTimeout(check,100)};check()
                    })""",{"ident":ident,"ids":[a,b,desktop_id]})
                both(desktop_id)
                assert {a,b,desktop_id}<=ids(read())
                print("Phone and tablet emulated touch ink before release, desktop and both mobile copies converged.")
            finally:
                for mobile in touch_contexts:mobile.close()
    finally:
        for ctx in contexts:ctx.close()

def main():
    asyncio.run(seed())
    if "--sync-only" in sys.argv:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            try:
                check_shared_eraser_sync(browser)
                check_undo_reconnect_sync(browser)
            finally:
                browser.close()
        return
    ident=setup_board()
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        check_service_unavailable(browser,ident)
        for name,author,owner in [("owner",True,True),("learner",False,False),("colleague",True,False),("observer",False,False)]:
            context=browser.new_context(viewport={"width":1440,"height":900})
            page=context.new_page()
            errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
            login(page,name)
            seed_legacy_empty_toolbar(page)
            page.screenshot(path=str(OUT/(name+"-desktop-home.png")))
            if name=="learner":
                expect(page.get_by_role("button",name="Я учусь",exact=True)).to_have_attribute("aria-pressed","true")
                page.once("dialog",lambda d:d.accept())
                page.get_by_role("button",name="Я преподаю",exact=True).click()
                expect(page.get_by_role("button",name="Я преподаю",exact=True)).to_have_attribute("aria-pressed","true",timeout=30000)
                page.get_by_role("button",name="Я учусь",exact=True).click()
                expect(page.get_by_role("button",name="Я учусь",exact=True)).to_have_attribute("aria-pressed","true")
                with httpx.Client(base_url=API,headers=headers(name)) as client:
                    assert client.get(f"/api/v1/boards/{ident}").json()["participant_role"]=="student"
            if owner: check_board_read_recovery(page,ident)
            assert_board(page,ident,author,owner)
            assert_role_toolbar(page,name!="observer",author)
            assert_history_controls(page,name!="observer")
            page.screenshot(path=str(OUT/(name+"-desktop-board.png")))
            if name=="learner":
                assert_drawing_saved(page,ident,name)
            if name=="observer":
                assert_viewer_mode(page)
                assert page.evaluate("""() => {
                  const user=JSON.parse(localStorage.getItem('lektrus.selfhost.session.v1')).user.id;
                  return Object.keys(localStorage).filter(k=>k.startsWith('lectris.toolbar.v3.'+user)||k.startsWith('lectris.named-layouts.v2.'+user)).length===0 &&
                    JSON.parse(localStorage.getItem('lectris.named-layouts.v1.'+user+'.student.desktop'))[0].pinned.join(',')==='pen,marker,eraser';
                }"""),"Viewing a read-only board must not overwrite toolbar preferences or named layouts"
                canvas=page.locator("section.board")
                world=canvas.locator(".world")
                before=world.evaluate("el=>el.style.transform")
                box=canvas.bounding_box()
                page.mouse.move(box["x"]+box["width"]*.5,box["y"]+box["height"]*.5)
                page.mouse.down()
                page.mouse.move(box["x"]+box["width"]*.5+80,box["y"]+box["height"]*.5+40,steps=8)
                page.mouse.up()
                page.wait_for_function("(before)=>document.querySelector(\"section.board .world\").style.transform!==before",arg=before)
                page.keyboard.press("v")
                assert_viewer_mode(page)
            if owner:
                page.locator('button[aria-label="Добавить участника"]:visible').first.click()
                expect(page.get_by_role("button",name="Сопреподаватель",exact=False)).to_be_visible()
                expect(page.get_by_role("button",name="Ученик",exact=False)).to_be_visible()
                expect(page.get_by_role("button",name="Наблюдатель",exact=False)).to_be_visible()
                page.screenshot(path=str(OUT/"owner-invitations.png"))
            page.set_viewport_size({"width":390,"height":844})
            page.goto(BASE+"/app")
            expect(page.get_by_role("button",name="Я учусь",exact=True)).to_be_visible(timeout=60000)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), f"{name}: horizontal overflow"
            page.screenshot(path=str(OUT/(name+"-phone-home.png")))
            mobile=browser.new_context(storage_state=context.storage_state(),viewport={"width":390,"height":844},has_touch=True,is_mobile=True)
            phone=mobile.new_page()
            phone.on("pageerror",lambda e:errors.append(str(e)))
            for width,height in ((320,640),(390,844),(768,1024)):
                assert_compact_workspace(phone,name,width,height)
            phone.set_viewport_size({"width":844,"height":390})
            scope=assert_board(phone,ident,author,owner,embedded=True)
            assert_role_toolbar(scope,name!="observer",author,touch=True)
            assert_history_controls(scope,name!="observer")
            if name=="observer":
                assert_viewer_mode(scope)
            phone.screenshot(path=str(OUT/(name+"-phone-board.png")))
            mobile.close()
            assert not errors, f"{name}: browser exceptions {errors}"
            context.close()
        check_shared_eraser_sync(browser)
        check_undo_reconnect_sync(browser)
        check_guest_and_registration(browser,ident)
        check_maintenance(browser,ident)
        check_billing_and_finance(browser)
        browser.close()
    print("All registered and guest participant contexts, registration modes, and persistent learner drawing passed browser acceptance")

if __name__=="__main__":
    main()
