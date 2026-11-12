#!/usr/bin/env python3
"""Browser acceptance for the public-site canvas, no auth bypass or production DB."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path("artifacts/site-studio")
root.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1360, "height": 950}, device_scale_factor=1)
    page.goto("http://127.0.0.1:5173/tests/site-studio-preview.html", wait_until="domcontentloaded")
    frame = page.frame_locator("#site")
    frame.locator(".marketing-site").wait_for()
    frame.locator('[data-site-dropzone="before-1/0"]').wait_for()
    frame.locator(".marketing-showcase-screen img").wait_for()
    assert frame.locator('[data-site-section-id="native-0"]').count() == 1, "Original Lektrus hero disappeared"
    assert frame.locator(".marketing-showcase-screen img").count() == 1, "Screenshot carousel disappeared"
    page.screenshot(path=str(root / "01-original.png"), full_page=True)

    # A real HTML5 drag crosses from parent palette into the preview iframe.
    page.locator("#drag-new").drag_to(frame.locator('[data-site-dropzone="before-1/0"]'), timeout=15000)
    page.wait_for_function("document.body.dataset.lastDrop === 'before-1'", timeout=10000)
    frame.get_by_text("Перенесённый блок").wait_for()
    position = frame.locator('[data-site-section-id="native-1"]').bounding_box()
    inserted = frame.locator(".site-block-text").filter(has_text="Перенесённый блок").bounding_box()
    assert position and inserted and inserted["y"] < position["y"], "Dropped block was not inserted before the target native section"
    page.screenshot(path=str(root / "02-dropped-between-sections.png"), full_page=True)

    # Click a native site's normal text, update it via the same preview message API
    # as the authenticated studio, and verify the public renderer shows the edit.
    heading = frame.locator('[data-site-section-id="native-1"] h2').first
    heading.click()
    page.wait_for_function("Boolean(document.body.dataset.objectSelected)", timeout=10000)
    heading.get_by_text("Отредактировано прямо на странице").wait_for(timeout=10000)
    color = heading.evaluate("(node) => getComputedStyle(node).color")
    assert color == "rgb(219, 57, 40)", f"Object style did not apply: {color}"
    page.screenshot(path=str(root / "03-object-override.png"), full_page=True)

    # The ready-made gallery kit must also be draggable, and real product
    # screenshots should remain reachable instead of becoming fake placeholders.
    page.locator("#drag-kit").drag_to(frame.locator('[data-site-dropzone="before-2/0"]'), timeout=15000)
    page.wait_for_function("document.body.dataset.lastDrop === 'before-2'", timeout=10000)
    frame.get_by_text("Галерея из библиотеки").wait_for()
    assert frame.locator(".site-block-gallery img").count() == 2
    document = page.evaluate("window.getSiteDraft()")
    assert document["pages"]["home"]["blocks"][0]["anchor"] == "before-1"
    assert document["pages"]["home"]["blocks"][1]["anchor"] == "before-2"
    assert document["objects"], "Object override was not serialized into the draft"

    frame.locator('[data-site-section-id="native-0"]').scroll_into_view_if_needed()
    page.locator("#site").evaluate("(node) => {node.style.width='390px';node.style.height='844px'}")
    frame.locator(".marketing-site").wait_for()
    page.screenshot(path=str(root / "04-phone.png"), full_page=True)
    browser.close()

print("Site studio browser PASS: native sections, real carousel, cross-frame DnD, object selection/editing/style, kit gallery and phone viewport.")
