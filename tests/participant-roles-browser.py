"""Real-browser acceptance against disposable Lektrus API/Postgres, not DOM mocks."""
import asyncio
import os
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

def assert_compact_workspace(page, name, width, height):
    page.set_viewport_size({"width":width,"height":height})
    page.goto(BASE+"/app?section=boards")
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
    page.screenshot(path=str(OUT/f"{name}-compact-{width}x{height}.png"))

def assert_board(page,ident,can_author,owner,*,navigate=True):
    if navigate:
        page.goto(BASE+"/board/"+ident)
    expect(page.locator("section.board")).to_be_visible(timeout=90000)
    subject=page.locator('button[aria-label="Предметные инструменты"]:visible')
    if can_author:
        expect(subject.first).to_be_visible(timeout=15000)
    else:
        expect(subject).to_have_count(0)
    share=page.locator('button[aria-label="Добавить участника"]:visible')
    if owner:
        expect(share.first).to_be_visible()
    else:
        expect(share).to_have_count(0)

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
            assert_board(page,ident,False,False,navigate=False)
            expect(page.get_by_role("button",name="Я преподаю",exact=True)).to_have_count(0)
            expect(page.locator(".student-board-mode")).to_have_text("Гость · ученик" if role=="student" else "Наблюдатель")
            pen=page.locator('[data-interface-control="pen"]:visible')
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

def main():
    asyncio.run(seed())
    ident=setup_board()
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
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
            page.goto(BASE+"/app?section=boards")
            expect(page.get_by_role("button",name="Я учусь",exact=True)).to_be_visible(timeout=60000)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), f"{name}: horizontal overflow"
            page.screenshot(path=str(OUT/(name+"-phone-home.png")))
            for width,height in ((320,640),(390,844),(768,1024)):
                assert_compact_workspace(page,name,width,height)
            page.set_viewport_size({"width":844,"height":390})
            assert_board(page,ident,author,owner)
            page.screenshot(path=str(OUT/(name+"-phone-board.png")))
            assert not errors, f"{name}: browser exceptions {errors}"
            context.close()
        check_guest_and_registration(browser,ident)
        browser.close()
    print("All registered and guest participant contexts, registration modes, and persistent learner drawing passed browser acceptance")

if __name__=="__main__":
    main()
