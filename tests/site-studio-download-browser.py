"""Real Chromium checks for the official APK download page, without downloading."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright


BASE = os.environ.get("LEKTRUS_TEST_SITE_URL", "http://127.0.0.1:5173")
APK = "https://github.com/Vue-Jay/interactive-board-next/releases/latest/download/Lektrus-Android.apk"
OUT = Path("artifacts/site-studio")
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    launch = {"headless": True, "args": ["--no-sandbox"]}
    if os.environ.get("CHROME_PATH"):
        launch["executable_path"] = os.environ["CHROME_PATH"]
    browser = p.chromium.launch(**launch)
    for width, height in [(320, 640), (390, 844), (768, 1024), (1440, 900)]:
        page = browser.new_page(viewport={"width": width, "height": height})
        page.goto(BASE + "/", wait_until="domcontentloaded")
        assert page.locator('.marketing-hero-copy a[href="#download"]').count() == 0
        entry = page.locator('.marketing-mobile-download' if width <= 920 else '.marketing-download-entry')
        entry.click()
        button = page.get_by_role("link", name="Скачать APK")
        button.wait_for()
        assert page.url.endswith("#download"), page.url
        assert button.get_attribute("href") == APK
        assert page.get_by_role("link", name="SHA-256").get_attribute("href") == APK + ".sha256"
        assert page.get_by_text("Не отключайте Play Защиту", exact=False).is_visible()
        assert page.locator(".marketing-download-web").get_attribute("href") == "/app"
        assert page.locator('.marketing-download-layout').evaluate('(el) => getComputedStyle(el).display') == 'grid'
        assert page.locator('.marketing-download-card').evaluate('(el) => parseFloat(getComputedStyle(el).borderRadius)') >= 16
        assert page.locator('.marketing-download-guide ol').evaluate('(el) => getComputedStyle(el).listStyleType') == 'none'
        box = button.bounding_box()
        assert box and box["height"] >= 44 and box["x"] >= 0 and box["x"] + box["width"] <= width + 1, box
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), width
        page.screenshot(path=OUT / f"download-{width}.png", full_page=True)
        page.reload(wait_until="domcontentloaded")
        button.wait_for()
        assert page.locator('.marketing-download-layout').evaluate('(el) => getComputedStyle(el).display') == 'grid'
        print(f"PASS official download {width}x{height}")
        page.close()
    browser.close()
