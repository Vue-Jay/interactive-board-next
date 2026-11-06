"""Browser acceptance of the actual LektrusHumanAnatomy component.
Launch via the Vite development server started by Anatomy visual review.
"""
from pathlib import Path
import json
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
    # Record actual frame timings during a real pointer-pan in Chromium.
    # This is a headless desktop browser diagnostic, NOT tablet FPS.
    page.evaluate("""() => {
      window.__lekFrameIntervals=[];
      window.__lekMeasure=true;
      let last=0;
      const tick=(now)=>{
        if(!window.__lekMeasure)return;
        if(last)window.__lekFrameIntervals.push(now-last);
        last=now;requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }""")
    # A pan may move the camera but MUST NOT report a new structure click.
    start=stage.bounding_box()
    cx=start["x"]+start["width"]/2
    cy=start["y"]+start["height"]/2
    previous=card.inner_text()
    page.mouse.move(cx,cy)
    page.mouse.down()
    page.mouse.move(cx+58,cy+35,steps=30)
    page.mouse.up()
    page.wait_for_timeout(450)
    timings=page.evaluate("""() => {
       window.__lekMeasure=false;
       const v=window.__lekFrameIntervals.slice().sort((a,b)=>a-b);
       return {frames:v.length,
         median_ms:v.length?v[Math.floor(v.length*.5)]:null,
         p95_ms:v.length?v[Math.floor(v.length*.95)]:null,
         max_ms:v.length?v[v.length-1]:null};
    }""")
    (OUT/"chromium-epidermis-pan-raf.json").write_text(
      json.dumps(timings,indent=2),encoding="utf-8")
    print("CHROMIUM rAF pan diagnostic (not physical tablet FPS):",timings)
    assert card.inner_text()==previous,"Dragging changed the selected cell"
    print("PASS: drag is not confused with a click")
    # Keyboard-accessible choice is available without pixel-perfect tapping.
    page.get_by_role("button",name="Роговой слой").click()
    assert "безъядерные" in card.inner_text().lower(),card.inner_text()
    page.screenshot(path=str(OUT/"epidermis-real-card.png"))
    print("PASS: layer selection and scientific information panel")
    # Wheel zoom is anchored to the real stage, not a simulated scale label.
    before=int(page.locator(".lek-anatomy-zoom span").inner_text().strip("%"))
    stage.hover()
    page.mouse.wheel(0,-180)
    page.wait_for_timeout(500)
    after=int(page.locator(".lek-anatomy-zoom span").inner_text().strip("%"))
    assert after>before,("Wheel zoom failed",before,after)
    print("PASS: real mouse wheel changes the continuous body camera")
    # Switching to a different system must hide the skin, never overlay it.
    page.get_by_role("button",name="Нервная").click()
    assert page.locator(".lek-anatomy-semantic-canvas").count()==0
    print("PASS: selecting a system hides the non-selected skin system")
    # Emulate a landscape touch tablet. Physical Android GPU performance
    # must be measured separately and is NOT claimed by this test.
    tablet=browser.new_context(viewport={"width":1200,"height":850},
      device_scale_factor=1,has_touch=True,is_mobile=True)
    touch=tablet.new_page()
    touch.goto(ROOT,wait_until="networkidle",timeout=60000)
    touch.locator("canvas.lek-anatomy-semantic-canvas").wait_for()
    touch.get_by_role("button",name="К клеткам").click()
    touch.wait_for_timeout(1100)
    target=touch.locator(".lek-anatomy-stage").bounding_box()
    assert target and target["width"]>=300,target
    touch.touchscreen.tap(target["x"]+target["width"]/2,
                         target["y"]+target["height"]/2)
    touch.locator(".lek-anatomy-epidermis-card").wait_for(timeout=5000)
    touch.screenshot(path=str(OUT/"epidermis-tablet-emulated-touch.png"))
    print("PASS: emulated tablet touch opens visible epidermis card")
    tablet.close()
    browser.close()
print("REAL CHROMIUM epidermis interactive test PASS")
