"""Browser acceptance of the actual LektrusHumanAnatomy component.
Launch via the Vite development server started by Anatomy visual review.
"""
from pathlib import Path
import re
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
    page.wait_for_timeout(450)
    cardbox=card.bounding_box()
    sidebar=page.locator(".lek-anatomy-details").bounding_box()
    assert cardbox and sidebar and cardbox["y"]>=sidebar["y"]-2 and (
        cardbox["y"]<sidebar["y"]+sidebar["height"]-25
    ),"Selected epidermis explanation must scroll into the visible sidebar"
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
    page.get_by_role("button",name="Покровная").click()
    # The epidermis information card used to scroll every ancestor on return.
    # That moved the whole atlas and put the details header over this button.
    # Test its REAL hit target, not a forced click through an overlay.
    page.screenshot(path=str(OUT/"system-return-before-reset.png"))
    reset_target=page.evaluate("""() => {
        const button=document.querySelector(".lek-anatomy-reset");
        if(!button)return {clickable:false,reason:"button missing"};
        const box=button.getBoundingClientRect();
        const hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);
        return {clickable:!!hit&&!!hit.closest(".lek-anatomy-reset"),
                hit:hit?.className??null,buttonY:box.y,
                sidebarScroll:document.querySelector(".lek-anatomy-details")?.scrollTop??null,
                windowScroll:window.scrollY};
    }""")
    assert reset_target["clickable"],(
        "Returning to skin must not overlay the real reset button",reset_target)
    page.get_by_role("button",name="Весь организм").click()
    page.wait_for_timeout(300)
    stage=page.locator(".lek-anatomy-stage")
    zoom_label=page.locator(".lek-anatomy-zoom span")
    zoom_number=lambda: int(re.search(r"(\d+)%",zoom_label.inner_text()).group(1))
    before=zoom_number()
    location=stage.bounding_box()
    assert location
    page.mouse.move(location["x"]+location["width"]*.45,
                    location["y"]+location["height"]*.50)
    page.mouse.wheel(0,-480)
    page.wait_for_timeout(450)
    assert zoom_number()>before,"Wheel must increase the shared camera zoom"
    page.mouse.wheel(0,480)
    page.wait_for_timeout(450)
    assert zoom_number()<max(200,before*3),"Reverse wheel should return toward the body"
    assert page.locator("canvas.lek-anatomy-semantic-canvas").count()==1
    print("PASS: Chromium pointer wheel zoom in/out does not switch anatomy system")

    # Actual browser emulation (NOT a claim to have tested a physical
    # Android tablet). Two independent touch IDs must drive the same camera
    # without ghost epidermal taps or displacing the specimen.
    touch_context=browser.new_context(
        viewport={"width":420,"height":840},device_scale_factor=1,
        is_mobile=True,has_touch=True)
    touch_page=touch_context.new_page()
    touch_page.goto(ROOT,wait_until="networkidle",timeout=60000)
    touch_stage=touch_page.locator(".lek-anatomy-stage")
    touch_stage.wait_for()
    touch_page.get_by_role("button",name="Весь организм").click()
    touch_page.wait_for_timeout(600)
    touch_zoom=touch_page.locator(".lek-anatomy-zoom span")
    initial_touch=int(re.search(r"(\d+)%",touch_zoom.inner_text()).group(1))
    box=touch_stage.bounding_box()
    assert box and box["width"]>170 and box["height"]>130,box
    x=box["x"]+box["width"]*.5
    y=box["y"]+box["height"]*.48
    cdp=touch_context.new_cdp_session(touch_page)
    start=[{"x":x-34,"y":y,"id":1},{"x":x+34,"y":y,"id":2}]
    end=[{"x":x-94,"y":y,"id":1},{"x":x+94,"y":y,"id":2}]
    cdp.send("Input.dispatchTouchEvent",{"type":"touchStart","touchPoints":start})
    for t in [0.25,0.50,0.75,1]:
        points=[{"x":start[i]["x"]+(end[i]["x"]-start[i]["x"])*t,
                 "y":y,"id":start[i]["id"]} for i in (0,1)]
        cdp.send("Input.dispatchTouchEvent",{"type":"touchMove","touchPoints":points})
        touch_page.wait_for_timeout(30)
    cdp.send("Input.dispatchTouchEvent",{"type":"touchEnd","touchPoints":[]})
    touch_page.wait_for_timeout(750)
    after_touch=int(re.search(r"(\d+)%",touch_zoom.inner_text()).group(1))
    assert after_touch>initial_touch,(
        "Emulated two-finger pinch must enlarge the complete body",
        initial_touch,after_touch)
    assert touch_page.locator("canvas.lek-anatomy-semantic-canvas").count()==1
    touch_page.screenshot(path=str(OUT/"mobile-pinch-zoom.png"))
    print("PASS: Chromium emulated two-finger pinch; physical tablet FPS NOT measured")
    touch_context.close()
    browser.close()
print("REAL CHROMIUM epidermis interactive test PASS")
