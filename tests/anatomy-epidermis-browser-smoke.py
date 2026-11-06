"""Browser acceptance of the actual LektrusHumanAnatomy component.
Launch via the Vite development server started by Anatomy visual review.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = "http://127.0.0.1:5173/tests/anatomy-epidermis-interactive-preview.html"
OUT = Path("artifacts/anatomy")
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1380,"height":850},
                          device_scale_factor=1)
    page.goto(ROOT,wait_until="networkidle",timeout=60000)
    page.locator("canvas.lek-anatomy-semantic-canvas").wait_for()
    page.wait_for_timeout(900)
    page.get_by_role("button",name="К клеткам").click()
    page.wait_for_timeout(1100)
    stage=page.locator(".lek-anatomy-stage")
    rect=stage.bounding_box()
    assert rect and rect["width"]>300 and rect["height"]>200,rect
    # Registered shoulder epidermis is precisely centred after user presses
    # "К клеткам", not after an implicit camera/sprite teleport.
    click={"x":rect["width"]/2,"y":rect["height"]/2}
    stage.click(position=click)
    card=page.locator(".lek-anatomy-epidermis-card")
    card.wait_for(timeout=5000)
    observed=card.inner_text()
    assert any(s in observed for s in [
        "Эпидермис","Роговой","Зернистый","Шиповатый",
        "Базальный","Меланоцит","соединение"]),observed
    print("PASS: direct tap on the body cutaway selected",observed.splitlines()[0])
    page.screenshot(path=str(OUT/"epidermis-real-click.png"))
    # A pan may move the camera but MUST NOT report a new structure click.
    start=stage.bounding_box()
    cx=start["x"]+start["width"]/2
    cy=start["y"]+start["height"]/2
    previous=card.inner_text()
    page.mouse.move(cx,cy)
    page.mouse.down()
    page.mouse.move(cx+58,cy+35,steps=5)
    page.mouse.up()
    assert card.inner_text()==previous,"Dragging changed the selected cell"
    print("PASS: drag is not confused with a click")
    # Keyboard-accessible choice is available without pixel-perfect tapping.
    page.get_by_role("button",name="Роговой слой").click()
    assert "безъядерные" in card.inner_text().lower(),card.inner_text()
    page.screenshot(path=str(OUT/"epidermis-real-card.png"))
    print("PASS: layer selection and scientific information panel")
    # Switching to a different system must hide the skin, never overlay it.
    page.get_by_role("button",name="Нервная").click()
    assert page.locator(".lek-anatomy-semantic-canvas").count()==0
    print("PASS: selecting a system hides the non-selected skin system")
    browser.close()
print("REAL CHROMIUM epidermis interactive test PASS")
