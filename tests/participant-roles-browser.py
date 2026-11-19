"""Real-browser acceptance against disposable Lektrus API/Postgres, not DOM mocks."""
import asyncio
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

def assert_drawing_saved(page,ident,name):
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
            if any(item.get("kind")=="pen" and item.get("createdBy")==saved["updated_by"] for item in items):
                return
            page.wait_for_timeout(500)
    raise AssertionError("Learner drawing did not persist to the real API")

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
            expect(scope.locator(".student-board-mode")).to_have_text("Гость · ученик" if role=="student" else "Наблюдатель")
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
        geometry=screen.evaluate("""node => {
          const card=node.querySelector('.u-card').getBoundingClientRect();
          const retry=node.querySelector('.u-retry').getBoundingClientRect();
          return {width:node.clientWidth,scrollWidth:node.scrollWidth,
            left:card.left,right:card.right,top:card.top,bottom:card.bottom,retryHeight:retry.height}
        }""")
        assert geometry["scrollWidth"]<=width+1 and geometry["left"]>=0 and geometry["right"]<=width+1,geometry
        assert geometry["retryHeight"]>=44 and geometry["top"]>=0 and geometry["bottom"]<=height+1,geometry
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

def check_maintenance(browser):
    async def promote():
        conn=await asyncpg.connect(os.environ["DATABASE_URL"])
        try:
            await conn.execute("UPDATE account_users SET is_admin=true WHERE email='owner@roles.example'")
        finally:
            await conn.close()
    asyncio.run(promote())
    contexts=[browser.new_context(viewport={"width":1440,"height":900},service_workers="block"),
              browser.new_context(viewport={"width":390,"height":844},service_workers="block"),
              browser.new_context(viewport={"width":390,"height":844},service_workers="block"),
              browser.new_context(viewport={"width":390,"height":844},service_workers="block")]
    admin,ordinary,selected,site=[ctx.new_page() for ctx in contexts]
    try:
        login(admin,"owner")
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
        ordinary.evaluate("window.dispatchEvent(new Event('lektrus:maintenance-changed'))")
        expect(ordinary.locator(".maintenance-notice")).to_contain_text("Запланированы технические работы",timeout=15000)
        expect(ordinary.get_by_role("button",name="Я учусь",exact=True)).to_be_visible()
        admin.once("dialog",lambda d:d.accept())
        panel.get_by_role("button",name="Начать сейчас").click()
        expect(panel.get_by_text("Сейчас ведутся технические работы",exact=True)).to_be_visible(timeout=15000)
        for page in (ordinary,selected,site):
            page.evaluate("window.dispatchEvent(new Event('lektrus:maintenance-changed'))")
        expect(ordinary.locator(".maintenance-blocking")).to_contain_text("Технические работы",timeout=15000)
        expect(ordinary.locator(".maintenance-blocking")).to_contain_text("Обновляем систему досок")
        expect(selected.locator(".maintenance-notice")).to_contain_text("У вас есть доступ",timeout=15000)
        expect(selected.get_by_role("button",name="Я учусь",exact=True)).to_be_visible()
        expect(site.locator(".maintenance-notice")).to_contain_text("Ведутся технические работы",timeout=15000)
        for page,name in [(admin,"admin"),(ordinary,"blocked-phone"),(selected,"allowed-phone"),(site,"site-phone")]:
            page.screenshot(path=str(OUT/f"maintenance-{name}.png"))
        # A new unauthenticated user can still reach the login form for an exception.
        fresh=browser.new_context(viewport={"width":390,"height":844},service_workers="block")
        try:
            page=fresh.new_page();page.goto(BASE+"/app")
            expect(page.locator(".maintenance-blocking")).to_be_visible(timeout=15000)
            page.get_by_role("button",name="Войти с разрешённым аккаунтом").click()
            expect(page.get_by_label("Email",exact=True)).to_be_visible(timeout=15000)
        finally:
            fresh.close()
        panel.get_by_role("button",name="Завершить работы").click()
        expect(panel.get_by_text("Сервис работает в обычном режиме",exact=True)).to_be_visible(timeout=15000)
        ordinary.evaluate("window.dispatchEvent(new Event('lektrus:maintenance-changed'))")
        expect(ordinary.locator(".maintenance-blocking")).to_have_count(0,timeout=15000)
        expect(ordinary.get_by_role("button",name="Я учусь",exact=True)).to_be_visible()
    finally:
        for ctx in contexts:ctx.close()
    print("Maintenance: scheduled banner, admin and selected access, blocked account, login and automatic recovery passed")

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
            page.screenshot(path=str(OUT/(name+"-desktop-board.png")))
            if name=="learner":
                assert_drawing_saved(page,ident,name)
            if name=="observer":
                expect(page.locator(".student-board-mode")).to_have_text("Наблюдатель")
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
            assert_board(phone,ident,author,owner,embedded=True)
            phone.screenshot(path=str(OUT/(name+"-phone-board.png")))
            mobile.close()
            assert not errors, f"{name}: browser exceptions {errors}"
            context.close()
        check_guest_and_registration(browser,ident)
        check_maintenance(browser)
        browser.close()
    print("All registered and guest participant contexts, registration modes, and persistent learner drawing passed browser acceptance")

if __name__=="__main__":
    main()
