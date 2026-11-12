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

    # Keyboard commands travel out of the iframe to the shared site editor.
    heading.click()
    page.keyboard.press("Delete")
    page.wait_for_function("document.body.dataset.lastCommand === 'delete'")
    assert not heading.is_visible(), "Delete should hide the selected native site element"
    assert page.evaluate("window.getSiteDraft().objects[window.lastObjectId].hidden") is True

    page.keyboard.press("Control+z")
    page.wait_for_function("document.body.dataset.lastCommand === 'undo'")
    assert heading.is_visible(), "Ctrl+Z should bring the hidden object back"
    page.keyboard.press("Control+Shift+z")
    page.wait_for_function("document.body.dataset.lastCommand === 'redo'")
    assert not heading.is_visible(), "Ctrl+Shift+Z should reapply deletion"
    frame.locator(".site-canvas-selection-actions .site-canvas-restore-button").click()
    page.wait_for_function("document.body.dataset.lastCommand === 'restore'")
    assert heading.is_visible(), "Floating toolbar must restore hidden objects"

    frame.locator(".site-canvas-selection-actions .site-canvas-delete-button").click()
    page.wait_for_function("document.body.dataset.lastCommand === 'delete'")
    assert not heading.is_visible()
    page.keyboard.press("Control+z")
    page.wait_for_function("document.body.dataset.lastCommand === 'undo'", timeout=10000)
    heading.wait_for(state="visible", timeout=10000)
    assert heading.is_visible(), "Undo after toolbar deletion should restore original content"

    # Select the inserted block via its dedicated affordance and stretch it.
    inserted_block = frame.locator(".site-editable-block").filter(has_text="Перенесённый блок")
    inserted_block.locator(".site-block-select-button").click()
    frame.locator(".site-editable-block[data-site-selected=true] .site-block-resize-both").wait_for()
    grip = frame.locator(".site-editable-block[data-site-selected=true] .site-block-resize-both")
    grip.scroll_into_view_if_needed(timeout=10000)
    grip.evaluate("(element) => element.scrollIntoView({block: \"center\", inline: \"nearest\"})")
    page.wait_for_timeout(100)
    handle = grip.bounding_box()
    assert handle
    page.mouse.move(handle["x"]+handle["width"]/2,handle["y"]+handle["height"]/2)
    page.mouse.down()
    page.mouse.move(handle["x"]-115,handle["y"]+95,steps=8)
    page.mouse.up()
    page.wait_for_function("Boolean(document.body.dataset.lastResize)", timeout=10000)
    dimensions = page.evaluate("""() => {
      const b=window.getSiteDraft().pages.home.blocks.find(b=>b.title==="Перенесённый блок");
      return [b.style.width,b.style.minHeight]
    }""")
    assert 35 <= dimensions[0] < 100, f"Width handle did not reduce block width: {dimensions}"
    assert 0 < dimensions[1] <= 1200, f"Height handle did not increase block height: {dimensions}"
    page.screenshot(path=str(root / "04-resized-block.png"), full_page=True)
    page.keyboard.press("Control+z")
    page.wait_for_function("""() => {
      const b=window.getSiteDraft().pages.home.blocks.find(b=>b.title==="Перенесённый блок");
      return b && b.style.width === undefined
    }""",timeout=10000)
    page.keyboard.press("Control+y")
    page.wait_for_function("""() => {
      const b=window.getSiteDraft().pages.home.blocks.find(b=>b.title==="Перенесённый блок");
      return b && typeof b.style.width === "number" && b.style.width < 100
    }""",timeout=10000)

    frame.locator('[data-site-section-id="native-0"]').scroll_into_view_if_needed()
    page.locator("#site").evaluate("(node) => {node.style.width='390px';node.style.height='844px'}")
    frame.locator(".marketing-site").wait_for()
    page.screenshot(path=str(root / "05-phone.png"), full_page=True)
    browser.close()

print("Site studio browser PASS: native sections, real carousel, cross-frame DnD, object selection/editing, keyboard delete undo/redo, toolbar restore, pointer width/height resize, kit gallery and phone viewport.")
