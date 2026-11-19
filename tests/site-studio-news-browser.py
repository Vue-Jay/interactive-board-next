"""Production bundle UI checks for the news journal, using a public API fixture."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("LEKTRUS_TEST_SITE_URL", "http://127.0.0.1:4173")
OUT = Path("artifacts/site-studio")
OUT.mkdir(parents=True, exist_ok=True)
ARTICLES = [
    dict(id="1",category="update",title="Lektrus на Android",summary="Официальное мобильное приложение",body="Обновление интерфейса доски.\n\nУстановите APK с сайта.",version="1.0",published_at="2026-11-19T10:00:00Z"),
    dict(id="2",category="feature",title="Преподавание и обучение в одном аккаунте",summary="Два рабочих пространства",body="Выбирайте режим работы.",version="",published_at="2026-11-18T10:00:00Z"),
    dict(id="3",category="announcement",title="Анатомия человека",summary="Интерактивное изучение строения организма и его систем.",body="Подробности анонса.",version="",published_at="2026-11-19T10:00:00Z"),
    dict(id="4",category="announcement",title="Виртуальный микроскоп",summary="Исследование микропрепаратов непосредственно на учебной доске.",body="Описание микроскопа.",version="",published_at="2026-11-19T10:00:00Z"),
    dict(id="5",category="announcement",title="Программирование на доске",summary="Редактор кода и запуск учебных программ внутри Lektrus.",body="Описание редактора кода.",version="",published_at="2026-11-19T10:00:00Z"),
]
for i, (title, date) in enumerate([
    ("Химическая лаборатория: полноценные эксперименты", "2026-11-16"),
    ("Личные шаблоны досок", "2026-11-15"),
    ("Гипербола и графики функций", "2026-11-15"),
    ("Предложения из слов", "2026-11-14"),
    ("ИИ-помощник на доске", "2026-11-11"),
    ("Линейка, угольник и транспортир", "2026-11-01"),
    ("Интерактивные модели по физике", "2026-10-25"),
    ("Геометрические построения", "2026-10-24"),
]):
    ARTICLES.append(dict(id=str(10+i),category="feature",title=title,summary="Новые инструменты для занятий на доске.",body="Подробности обновления.",version="",published_at=date+"T12:00:00Z"))

def respond(route):
    q = parse_qs(urlparse(route.request.url).query)
    assert not route.request.headers.get("authorization"), "Public news must not transmit auth"
    rows = [row for row in ARTICLES if not q.get("category") or row["category"] == q["category"][0]]
    start, limit = int(q["offset"][0]), int(q["limit"][0])
    route.fulfill(status=200,content_type="application/json",body=json.dumps(rows[start:start+limit]))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,args=["--no-sandbox"],executable_path=os.environ.get("LEKTRUS_CHROMIUM_EXECUTABLE"))
    for width,height in [(320,640),(390,844),(768,1024),(1440,900)]:
        page=browser.new_page(viewport={"width":width,"height":height})
        page.route("**/api/v1/news?*", respond)
        page.goto(BASE+"/#news",wait_until="domcontentloaded")
        page.get_by_role("heading",name="Новости и обновления").wait_for()
        page.get_by_role("heading",name="Lektrus на Android").wait_for()
        assert page.locator(".marketing-news-layout").evaluate("el=>getComputedStyle(el).display") == "grid"
        assert page.locator(".marketing-news-card").count() == 12
        assert page.locator(".marketing-news-soon").count() == 3
        assert page.locator(".marketing-news-card").evaluate_all("cards=>cards.every(c=>c.getBoundingClientRect().height<200)"), width
        assert page.locator(".marketing-news-card").evaluate_all("cards=>cards.slice(1).every((c,i)=>c.getBoundingClientRect().top>=cards[i].getBoundingClientRect().bottom-1&&Math.abs(c.getBoundingClientRect().left-cards[0].getBoundingClientRect().left)<1)"), width
        if width == 1440:
            assert page.locator(".marketing-news-card").evaluate_all("cards=>cards.every(c=>c.getBoundingClientRect().height<125)"), "Desktop cards must be compact horizontal rows"
        telegram=page.get_by_role("link",name="Мы в Telegram",exact=False)
        assert telegram.is_visible()
        assert telegram.get_attribute("href") == "https://t.me/lektrus"
        assert telegram.evaluate("el=>el.getBoundingClientRect().height<65")
        assert telegram.evaluate("el=>el.getBoundingClientRect().bottom<=document.querySelector('.marketing-news-feed').getBoundingClientRect().top")
        if width == 1440:
            assert telegram.evaluate("el=>Math.abs(el.getBoundingClientRect().top-document.querySelector('.marketing-news-toolbar').getBoundingClientRect().top)<2")
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), width
        page.screenshot(path=OUT/f"news-{width}.png",full_page=True)
        page.get_by_role("button",name="Анонсы",exact=True).click()
        expect(page.locator(".marketing-news-card")).to_have_count(3)
        page.get_by_role("heading",name="Анатомия человека").wait_for()
        page.locator(".marketing-news-card").filter(has_text="Анатомия человека").locator("summary").click()
        assert page.get_by_text("Подробности анонса.",exact=True).is_visible()
        page.get_by_role("button",name="Все записи",exact=True).click()
        expect(page.locator(".marketing-news-card")).to_have_count(12)
        page.get_by_role("heading",name="Lektrus на Android").wait_for()
        page.get_by_role("button",name="Далее →",exact=True).click()
        expect(page.locator(".marketing-news-card")).to_have_count(1)
        page.get_by_role("heading",name="Геометрические построения").wait_for()
        page.get_by_role("button",name="← Назад",exact=True).click()
        expect(page.locator(".marketing-news-card")).to_have_count(12)
        page.close()
    # Real board route: rounded screen corner clearance and navigator style.
    for width,height in [(1440,900),(1024,390),(844,390)]:
        page=browser.new_page(viewport={"width":width,"height":height},has_touch=width<1000)
        page.goto(BASE+"/demo/board?scene=math",wait_until="domcontentloaded")
        # Touch browsers open the logical landscape board in a same-origin
        # iframe, even if their physical viewport is already landscape.
        scope=page.frame_locator("iframe.lektrus-browser-board-frame") if width<1000 else page
        more=scope.locator(".topbar-more-trigger")
        more.wait_for(timeout=25000)
        if width<1000:
            assert more.evaluate("el=>innerWidth-el.getBoundingClientRect().right") >= 16
        navigator=scope.get_by_role("region",name="Навигатор доски")
        navigator.wait_for()
        assert navigator.get_by_text("Навигатор",exact=True).is_visible()
        assert navigator.locator(".minimap-header svg").count()==0
        map_surface=navigator.locator(".minimap-canvas")
        bounds=map_surface.bounding_box()
        assert bounds['width'] >= (210 if width==1440 else 200), bounds
        assert bounds['height'] >= (120 if width==1440 else 96), bounds
        assert navigator.evaluate("el=>{const a=el.getBoundingClientRect(),b=document.querySelector('.board-controls').getBoundingClientRect();return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top}")
        def check_geometry():
            result=map_surface.evaluate('''svg=>{
                const frame=svg.querySelector('.minimap-viewport'), b=document.querySelector('.board').getBoundingClientRect();
                const v=svg.viewBox.baseVal, r=frame.getBBox(), m=new DOMMatrix(getComputedStyle(document.querySelector('.board .world')).transform);
                const scale=svg.getScreenCTM(), real=frame.getBoundingClientRect();
                return {uniform:Math.abs(scale.a-scale.d)<1e-6, ratio:Math.abs(real.width/real.height-b.width/b.height)<.015,
                    correct:Math.abs(r.x+m.e/m.a)<1.5 && Math.abs(r.y+m.f/m.a)<1.5 && Math.abs(r.width-b.width/m.a)<1.5 && Math.abs(r.height-b.height/m.a)<1.5,
                    contained:r.x>=v.x-.01&&r.y>=v.y-.01&&r.x+r.width<=v.x+v.width+.01&&r.y+r.height<=v.y+v.height+.01};
            }''')
            assert all(result.values()), (width,result)
        check_geometry()
        navigator.screenshot(path=OUT/f"navigator-{width}.png")
        transform=scope.locator('.board .world').evaluate("el=>el.style.transform")
        page.mouse.move(bounds['x']+bounds['width']*.25,bounds['y']+bounds['height']*.3)
        page.mouse.down()
        page.mouse.move(bounds['x']+bounds['width']*.75,bounds['y']+bounds['height']*.7,steps=8)
        page.wait_for_timeout(100) # allow compositor animation frame before release
        check_geometry()
        page.mouse.up()
        assert scope.locator('.board .world').evaluate("el=>el.style.transform") != transform, 'Dragging the navigator must pan the board'
        check_geometry()
        page.screenshot(path=OUT/f"board-chrome-{width}.png")
        page.close()
    browser.close()
