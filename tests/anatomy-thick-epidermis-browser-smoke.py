"""Chromium acceptance: five glabrous epidermal strata are real body-world
regions that can be selected without falsifying the frontal silhouette."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT="http://127.0.0.1:5173/tests/anatomy-epidermis-interactive-preview.html"
OUT=Path("artifacts/anatomy")
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1380,"height":850},
                          device_scale_factor=1)
    page.goto(ROOT,wait_until="networkidle",timeout=60000)
    page.locator("canvas.lek-anatomy-semantic-canvas").wait_for()
    page.wait_for_timeout(850)
    assert page.get_by_role("button",name="Блестящий слой").count()==0
    for kind,title in [("palm","Ладонь · 5 слоёв"),
                       ("sole","Подошва · 5 слоёв")]:
        page.get_by_role("button",name=title).click()
        page.wait_for_timeout(850)
        assert page.get_by_role("button",name=title).get_attribute(
         "aria-pressed")=="true",title
        assert page.get_by_role("button",name="Блестящий слой").count()==1
        assert page.get_by_text("виртуальный",exact=False).count()>0
        assert page.get_by_text("пока не удалось найти",exact=False).count()==0,(
         kind+" specimen must be physically registered to body silhouette")
        card=page.locator(".lek-anatomy-epidermis-card")
        card.wait_for()
        assert "Блестящий слой" in card.inner_text(),card.inner_text()
        stage=page.locator(".lek-anatomy-stage")
        rect=stage.bounding_box()
        assert rect and rect["width"]>300
        stage.click(position={"x":rect["width"]/2,"y":rect["height"]/2})
        page.wait_for_timeout(350)
        assert "Блестящий слой" in card.inner_text(),(
         "Tap at the registered glabrous microscope target should hit "
         "the actual stratum lucidum, not an unregistered neighbouring layer: "
         +card.inner_text())
        page.screenshot(path=str(OUT/f"thick-{kind}-lucidum-real-click.png"))
        print("PASS real app",kind,"world-registered lucidum click")
    page.get_by_role("button",name="Плечо · 4 слоя").click()
    assert page.get_by_role("button",name="Блестящий слой").count()==0
    page.get_by_role("button",name="Нервная").click()
    assert page.locator(".lek-anatomy-semantic-canvas").count()==0
    print("PASS restored thin skin and isolated nervous system")
    browser.close()
