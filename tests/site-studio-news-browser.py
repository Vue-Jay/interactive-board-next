"""Production bundle UI checks for the news journal, using a public API fixture."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LEKTRUS_TEST_SITE_URL", "http://127.0.0.1:4173")
OUT = Path("artifacts/site-studio")
OUT.mkdir(parents=True, exist_ok=True)
ARTICLES = [
    dict(id="1",category="update",title="Lektrus на Android",summary="Официальное мобильное приложение",body="Обновление интерфейса доски.\n\nУстановите APK с сайта.",version="1.0",published_at="2026-11-19T10:00:00Z"),
    dict(id="2",category="feature",title="Преподавание и обучение в одном аккаунте",summary="Два рабочих пространства",body="Выбирайте режим работы.",version="",published_at="2026-11-18T10:00:00Z"),
    dict(id="3",category="announcement",title="Что дальше",summary="Планы развития платформы",body="Подробности анонса.",version="",published_at="2026-11-17T10:00:00Z"),
]

def respond(route):
    q = parse_qs(urlparse(route.request.url).query)
    assert not route.request.headers.get("authorization"), "Public news must not transmit auth"
    rows = [row for row in ARTICLES if not q.get("category") or row["category"] == q["category"][0]]
    start, limit = int(q["offset"][0]), int(q["limit"][0])
    route.fulfill(status=200,content_type="application/json",body=json.dumps(rows[start:start+limit]))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,args=["--no-sandbox"])
    for width,height in [(320,640),(390,844),(768,1024),(1440,900)]:
        page=browser.new_page(viewport={"width":width,"height":height})
        page.route("**/api/v1/news?*", respond)
        page.goto(BASE+"/#news",wait_until="domcontentloaded")
        page.get_by_role("heading",name="Новости и обновления").wait_for()
        page.get_by_role("heading",name="Lektrus на Android").wait_for()
        assert page.locator(".marketing-news-layout").evaluate("el=>getComputedStyle(el).display") == "grid"
        assert page.locator(".marketing-news-card").count() == 3
        assert page.get_by_role("heading",name="Мы в Telegram").is_visible()
        assert page.get_by_role("link",name="Перейти в канал").get_attribute("href") == "https://t.me/lektrus"
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), width
        page.screenshot(path=OUT/f"news-{width}.png",full_page=True)
        page.get_by_role("button",name="Анонсы",exact=True).click()
        page.get_by_role("heading",name="Что дальше").wait_for()
        assert page.locator(".marketing-news-card").count() == 1
        page.locator(".marketing-news-detail summary").click()
        assert page.get_by_text("Подробности анонса.",exact=True).is_visible()
        page.get_by_role("button",name="Все записи",exact=True).click()
        page.get_by_role("heading",name="Lektrus на Android").wait_for()
        assert page.locator(".marketing-news-card").count() == 3
        page.close()
    browser.close()
