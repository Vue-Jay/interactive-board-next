"""Real-browser acceptance against disposable Lektrus API/Postgres, not DOM mocks."""
import asyncio
import json
from functools import lru_cache
import os
import re
from pathlib import Path
from uuid import uuid4
import asyncpg
import bcrypt
import httpx
from playwright.sync_api import sync_playwright, expect

BASE="http://127.0.0.1:5173"
API="http://127.0.0.1:8000"
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
    controls={page:{"hold":None,"held":[],"commits":[]} for page in (teacher,pupil)}
    for page,control in controls.items():
        def route_ws(route,control=control):
            upstream=route.connect_to_server()
            def outgoing(message):
                frame=json.loads(message)
                if frame.get("type")=="ink_commit":
                    control["commits"].append(frame)
                    changes=frame.get("delta",{}).get("items",{})
                    if control["hold"] and any(i.get("id")==control["hold"] for i in changes.get("upsert",[])+changes.get("point_edits",[])):
                        control["held"].append((upstream,message));return
                upstream.send(message)
            route.on_message(outgoing)
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

def main():
    asyncio.run(seed())
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
        check_guest_and_registration(browser,ident)
        check_maintenance(browser,ident)
        check_billing_and_finance(browser)
        browser.close()
    print("All registered and guest participant contexts, registration modes, and persistent learner drawing passed browser acceptance")

if __name__=="__main__":
    main()
