"""Isolated visual acceptance of the real, shared board access dialog."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("LEKTRUS_TEST_SITE_URL", "http://127.0.0.1:5173")
OUT = Path("artifacts/share-dialog")
OUT.mkdir(parents=True, exist_ok=True)
DATE = "2026-11-19T00:00:00Z"
BOARD = "00000000-0000-4000-8000-000000000001"
ACCESS = {
    "members": [
        dict(user_id="one", name="Мария Иванова", email="maria@example.test", role="editor", participant_role="student", added_at=DATE),
        dict(user_id="two", name="Сергей Петров", email="very-long-colleague-email-address@example.test", role="editor", participant_role="co_teacher", added_at=DATE),
    ],
    "invites": [dict(id="invite", email="student.with.a.long.email@example.test", role="editor", participant_role="student", created_at=DATE)],
}
LINKS = [
    dict(id="first", board_id=BOARD, role="editor", participant_role="student", created_at=DATE, expires_at=None, revoked_at=None, max_uses=10, use_count=2, protected=True),
    dict(id="second", board_id=BOARD, role="viewer", participant_role="observer", created_at=DATE, expires_at=None, revoked_at=None, max_uses=None, use_count=0, protected=False),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"], executable_path=os.environ.get("LEKTRUS_CHROMIUM_EXECUTABLE"))
    for width, height in [(1440,900),(768,1024),(390,844),(844,390),(320,640)]:
        page = browser.new_page(viewport={"width":width,"height":height}, has_touch=width<1000)
        page.route("**/api/v1/boards/*/access", lambda r:r.fulfill(json=ACCESS))
        page.route("**/api/v1/boards/*/share-links", lambda r:r.fulfill(json=LINKS))
        page.goto(BASE+"/tests/share-dialog-preview.html")
        dialog = page.get_by_role("dialog",name="Доступ к доске")
        expect(dialog).to_be_visible(timeout=30000)
        expect(dialog.get_by_role("button",name="Участники 4")).to_be_visible()
        def geometry():
            assert dialog.evaluate("""el=>{
              const box=el.getBoundingClientRect();
              return box.left>=0 && box.right<=innerWidth+1 && box.top>=0 && box.bottom<=innerHeight+1 &&
                el.scrollWidth<=el.clientWidth+1 && [...el.querySelectorAll('.share-option,.share-list-row,.lektrus-share-tabs>button,.lektrus-share-copy')].filter(e=>e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1;});
            }"""), (width,height)
        geometry()
        page.screenshot(path=OUT/f"invite-{width}.png")
        dialog.locator(".share-direct-link summary").click()
        expect(dialog.get_by_label("Адрес доски")).to_be_visible()
        geometry()
        dialog.locator(".share-email-panel summary").click()
        expect(dialog.get_by_label("Email пользователя")).to_be_visible()
        geometry()
        dialog.locator(".share-email-panel summary").scroll_into_view_if_needed()
        page.screenshot(path=OUT/f"direct-email-{width}.png")
        dialog.get_by_role("button",name="Участники 4").click()
        expect(dialog.get_by_text("Мария Иванова")).to_be_visible()
        expect(dialog.get_by_text("Ожидают входа")).to_be_visible()
        geometry()
        page.screenshot(path=OUT/f"people-{width}.png")
        dialog.get_by_role("button",name="Ссылки 2").click()
        expect(dialog.get_by_text("Активные приглашения")).to_be_visible()
        expect(dialog.get_by_text("Входы: 2 из 10")).to_be_visible()
        geometry()
        page.screenshot(path=OUT/f"links-{width}.png")
        page.close()
    browser.close()
