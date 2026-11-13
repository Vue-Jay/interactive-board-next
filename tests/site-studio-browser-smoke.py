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
    heading.wait_for(state="hidden", timeout=10000)
    assert not heading.is_visible(), "Delete should hide the selected native site element"
    assert page.evaluate("window.getSiteDraft().objects[window.lastObjectId].hidden") is True

    page.keyboard.press("Control+z")
    page.wait_for_function("document.body.dataset.lastCommand === 'undo'")
    heading.wait_for(state="visible", timeout=10000)
    assert heading.is_visible(), "Ctrl+Z should bring the hidden object back"
    page.keyboard.press("Control+Shift+z")
    page.wait_for_function("document.body.dataset.lastCommand === 'redo'")
    heading.wait_for(state="hidden", timeout=10000)
    assert not heading.is_visible(), "Ctrl+Shift+Z should reapply deletion"
    frame.locator(".site-canvas-selection-actions .site-canvas-restore-button").click()
    page.wait_for_function("document.body.dataset.lastCommand === 'restore'")
    heading.wait_for(state="visible", timeout=10000)
    assert heading.is_visible(), "Floating toolbar must restore hidden objects"

    frame.locator(".site-canvas-selection-actions .site-canvas-delete-button").click()
    page.wait_for_function("document.body.dataset.lastCommand === 'delete'")
    heading.wait_for(state="hidden", timeout=10000)
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
    debug = grip.evaluate("""el => {
      const r = el.getBoundingClientRect();
      const target = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      window.__resizeEvents=[];
      ["pointerdown","pointermove","pointerup","pointercancel","lostpointercapture","dragstart"].forEach(type =>
        document.addEventListener(type,e=>{
          if((e.target instanceof Element)&&e.target.closest(".site-block-resize-handle"))
           window.__resizeEvents.push(type+":"+e.clientX+","+e.clientY);
        },true)
      );
      return {x:r.x,y:r.y,w:r.width,h:r.height,
        hit:target?.outerHTML.slice(0,250),viewport:[innerWidth,innerHeight],draggable:el.closest(".site-editable-block")?.draggable};
    }""")
    print("RESIZE BEFORE",debug,flush=True)
    page.mouse.move(handle["x"]+handle["width"]/2,handle["y"]+handle["height"]/2)
    page.mouse.down()
    page.mouse.move(handle["x"]-115,handle["y"]+95,steps=8)
    page.mouse.up()
    print("RESIZE AFTER",grip.evaluate("""el => ({
      events:window.__resizeEvents,
      width:el.closest(".site-editable-block")?.style.width,
      height:el.closest(".site-editable-block")?.style.minHeight
    })"""),flush=True)
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
    # Validate actual visitor pages, native frame animation, sidebar and
    # responsive layouts without relying on the Site Studio-only preview.
    visitor = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    visitor.goto("http://127.0.0.1:5173/#home", wait_until="domcontentloaded")
    # Typography acceptance: actual self-hosted Cyrillic fonts render in Chromium.
    visitor.wait_for_function("""() =>
      document.fonts.check('700 24px "Lektrus Onest"') &&
      document.fonts.check('400 16px "Lektrus Golos Text"')
    """, timeout=12000)
    brand_face = visitor.locator(".marketing-hero-brand-name").evaluate("(el) => getComputedStyle(el).fontFamily")
    copy = visitor.locator(".marketing-hero-lead").evaluate("""el => ({
      family:getComputedStyle(el).fontFamily,
      size:parseFloat(getComputedStyle(el).fontSize),
      line:parseFloat(getComputedStyle(el).lineHeight)
    })""")
    menu_size = visitor.locator(".marketing-nav a").first.evaluate("(el) => parseFloat(getComputedStyle(el).fontSize)")
    assert "Lektrus Onest" in brand_face, f"Brand heading must use Onest: {brand_face}"
    hero_logo = visitor.locator(".marketing-hero-logo")
    assert hero_logo.count() == 1, "Home hero must contain one official brand symbol"
    assert hero_logo.get_attribute("src") == "/lektrus-icon-192.png"
    assert hero_logo.get_attribute("alt") == "", "Wordmark already supplies the logo's accessible name"
    visitor.wait_for_function("() => { const img=document.querySelector('.marketing-hero-logo'); return !!img && img.complete && img.naturalWidth === 192 }")
    logo_bounds = hero_logo.bounding_box()
    title_bounds = visitor.locator(".marketing-hero-identity h1").bounding_box()
    assert logo_bounds and title_bounds and logo_bounds["width"] >= 65, "Logo must be legible at desktop size"
    assert title_bounds["x"] > logo_bounds["x"] + logo_bounds["width"] + 6, "Logo must sit beside, not over, the title"
    assert abs(logo_bounds["y"] - title_bounds["y"]) < 22, "Logo and headline should share a top alignment"
    # The brand name must not visually collapse into touching glyphs.
    for selector in [".marketing-hero-brand-name", ".marketing-brand strong"]:
        spacing = visitor.locator(selector).first.evaluate("(el) => getComputedStyle(el).letterSpacing")
        assert spacing == "normal" or float(spacing.replace("px", "")) >= 0, f"Overtight Lektrus wordmark: {selector}={spacing}"
    assert "Lektrus Golos Text" in copy["family"] and copy["size"] >= 15 and copy["line"] >= copy["size"] * 1.6, f"Body text is too cramped: {copy}"
    assert menu_size >= 14, f"Desktop navigation is too small: {menu_size}"

    showcase = visitor.locator(".marketing-showcase")
    showcase.wait_for()
    nav = visitor.locator("#marketing-nav a").all_inner_texts()
    assert nav == ["Главная", "Возможности", "Тарифы", "Помощь и контакты"], f"Site must have four public tabs: {nav}"
    assert visitor.locator(".marketing-sidebar-caption").last.text_content().strip() == "Инструменты"
    assert visitor.locator(".marketing-sidebar-tools a").count() == 2
    shortcuts = visitor.locator(".marketing-sidebar-tools a")
    assert shortcuts.nth(0).get_attribute("href") == "/tools/atlas"
    assert shortcuts.nth(1).get_attribute("href") == "/tools/laboratory"

    rail = visitor.locator(".marketing-header").bounding_box()
    intro = visitor.locator(".marketing-hero-copy").bounding_box()
    screen = showcase.bounding_box()
    assert rail and intro and screen
    assert rail["x"] < 2 and 220 <= rail["width"] <= 280 and rail["height"] >= 850
    assert intro["x"] >= rail["width"] + 18 and screen["x"] > intro["x"] + intro["width"]
    assert abs(intro["y"] - screen["y"]) < 220
    assert showcase.locator(".marketing-showcase-screen").count() == 1
    assert showcase.locator("button").count() == 0, "No slideshow player controls"
    assert visitor.locator(".marketing-project-summary").is_visible(), "Project section must follow Home hero"
    assert visitor.locator(".marketing-project-audiences p").count() == 2, "Both teacher and student benefits belong on Home"
    assert visitor.locator(".marketing-project-heading").is_visible()
    assert visitor.locator(".marketing-project-outro").is_visible(), "Project summary must remain visible"
    assert visitor.locator(".marketing-project-outro-icon").count() == 0, "Remove only the decorative star"
    caption = visitor.locator(".marketing-project-journey-heading .marketing-eyebrow")
    heading = visitor.locator(".marketing-project-journey-heading h3")
    caption_style = caption.evaluate("""el => ({
        size:getComputedStyle(el).fontSize, weight:getComputedStyle(el).fontWeight,
        family:getComputedStyle(el).fontFamily, color:getComputedStyle(el).color,
        spacing:getComputedStyle(el).letterSpacing, transform:getComputedStyle(el).textTransform
    })""")
    heading_style = heading.evaluate("""el => ({
        size:getComputedStyle(el).fontSize, weight:getComputedStyle(el).fontWeight,
        family:getComputedStyle(el).fontFamily, color:getComputedStyle(el).color,
        spacing:getComputedStyle(el).letterSpacing, transform:getComputedStyle(el).textTransform
    })""")
    assert caption_style == heading_style, f"Both stage captions must match: {caption_style} != {heading_style}"
    assert visitor.locator(".marketing-footer-home").count() == 1, "Home must have one branded footer"
    assert visitor.locator(".marketing-footer-home-brand").is_visible()
    assert visitor.locator(".marketing-footer-home-links").count() == 2
    assert visitor.locator(".marketing-footer-home-links a[href='/tools/atlas']").count() == 1
    assert visitor.locator(".marketing-footer-home-links a[href='/tools/laboratory']").count() == 1
    assert visitor.locator(".marketing-footer-home-app[href='/app']").count() == 1
    assert visitor.locator(".marketing-home-summary, .marketing-audience-grid, .marketing-last-cta").count() == 0
    screen_image = showcase.locator(".marketing-showcase-motion img:last-of-type")
    first = screen_image.get_attribute("src")
    assert first == "/site/showcase-workspace.png", "The first capture must be the user's approved workspace"
    visitor.wait_for_function(
        "() => { const image=document.querySelector('.marketing-showcase-motion img:last-of-type'); return image?.complete && image.naturalWidth > 0 }",
        timeout=10000
    )
    visitor.wait_for_function(
        "(initial) => document.querySelector('.marketing-showcase-motion img:last-of-type')?.getAttribute('src') !== initial",
        arg=first, timeout=13000
    )
    visitor.wait_for_function(
        "() => {const images=document.querySelectorAll('.marketing-showcase-motion img'); const current=images[images.length-1]; return !!current && current.complete && current.naturalWidth > 0 && parseFloat(getComputedStyle(current).opacity) > .99}",
        timeout=6000
    )
    assert showcase.locator(".marketing-showcase-motion img").count() <= 2, "Only the current and outgoing captures may be shown"
    assert showcase.locator(".marketing-showcase-motion img:last-of-type").get_attribute("src") != first
    visitor.screenshot(path=str(root / "06-home-dynamic-reel.png"), full_page=True)

    visitor.goto("http://127.0.0.1:5173/#features", wait_until="domcontentloaded")
    groups = visitor.locator(".marketing-feature-group")
    assert groups.count() == 3, "Features must follow three work stages"
    assert [group.locator(".marketing-feature-item").count() for group in groups.all()] == [2, 3, 2], "Feature groups must contain 2 / 3 / 2 practical capabilities"
    assert visitor.locator(".marketing-feature-item").count() == 7
    assert visitor.locator(".marketing-feature-icon svg").count() == 7, "All capabilities need consistent line icons"
    assert visitor.locator(".marketing-features-section a, .marketing-features-section button").count() == 0, "Feature descriptions must not link to board creation"
    assert visitor.locator(".marketing-features-section img, .marketing-showcase").count() == 0, "Features must use text and icons, not screenshots"
    card_grid = visitor.locator(".marketing-feature-items-cards").first.evaluate("(el) => getComputedStyle(el).gridTemplateColumns")
    assert len(card_grid.split()) == 2, f"Desktop preparation cards should display as two columns: {card_grid}"
    assert visitor.locator(".marketing-feature-group-heading h2").count() == 3
    assert visitor.locator(".marketing-feature-item-copy h3").count() == 7
    footer = visitor.locator(".marketing-footer").bounding_box()
    assert footer and footer["y"] + footer["height"] >= 885, "Short Features page should anchor footer to the bottom of the viewport"
    visitor.screenshot(path=str(root / "07-features-prose.png"), full_page=True)

    visitor.goto("http://127.0.0.1:5173/#pricing", wait_until="domcontentloaded")
    assert visitor.locator(".marketing-plan").count() == 3
    assert visitor.locator(".marketing-pricing-note").count() == 0, "Pricing disclaimer must not be shown"
    visitor.screenshot(path=str(root / "08-pricing-compact.png"), full_page=True)
    visitor.goto("http://127.0.0.1:5173/#help", wait_until="domcontentloaded")
    assert visitor.locator(".marketing-help-intro h1").inner_text() == "Чем можем помочь?"
    assert visitor.locator(".marketing-faq details").count() == 5
    assert visitor.locator(".marketing-help-contact .marketing-form-card").is_visible()
    assert visitor.locator('.marketing-help-contact form.lektrus-feedback-form').count() == 1
    faq_box = visitor.locator(".marketing-help-questions").bounding_box()
    contact_box = visitor.locator(".marketing-help-contact").bounding_box()
    assert faq_box and contact_box and contact_box["x"] >= faq_box["x"] + faq_box["width"] - 5, "Desktop FAQ and contact form should be side by side"
    assert abs(contact_box["y"] - faq_box["y"]) < 45, "Two help columns must start together"
    first_question = visitor.locator(".marketing-faq details").first
    assert not first_question.evaluate("(el) => el.open"), "FAQ answers should start collapsed"
    first_question.locator("summary").click()
    assert first_question.evaluate("(el) => el.open"), "FAQ answer must expand on click"
    assert first_question.locator("p").is_visible()
    first_question.locator("summary").press("Enter")
    assert not first_question.evaluate("(el) => el.open"), "FAQ answer must close from the keyboard"
    assert visitor.locator(".marketing-help-contact input[type='email']").count() == 1
    assert visitor.locator(".marketing-help-contact select").count() == 1
    assert visitor.locator(".marketing-help-contact textarea[required]").count() == 1
    assert visitor.locator(".marketing-help-contact button[type='submit']").is_disabled(), "Empty feedback must not be submitted"
    visitor.screenshot(path=str(root / "09-help-compact.png"), full_page=True)

    for old_route in ("about", "how", "tools", "teachers", "students"):
        visitor.goto("http://127.0.0.1:5173/#" + old_route, wait_until="domcontentloaded")
        visitor.locator(".marketing-project-summary").wait_for()
        assert visitor.locator(".marketing-about-practical, .marketing-standalone-tools, .marketing-how-list").count() == 0, f"Old {old_route} layout unexpectedly rendered"

    visitor.set_viewport_size({"width": 390, "height": 844})
    for page_name, marker in (
        ("home", ".marketing-project-summary"),
        ("features", ".marketing-feature-groups"),
        ("pricing", ".marketing-pricing-grid"),
        ("help", ".marketing-form-card")
    ):
        visitor.goto("http://127.0.0.1:5173/#" + page_name, wait_until="domcontentloaded")
        visitor.locator(marker).wait_for()
        assert visitor.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f"Mobile {page_name} overflows horizontally"
        assert visitor.locator("h1").first.evaluate("(el) => parseFloat(getComputedStyle(el).fontSize)") >= 29, f"Mobile {page_name} heading is too small"
        if page_name == "home":
            assert visitor.locator(".marketing-hero-lead").evaluate("(el) => parseFloat(getComputedStyle(el).fontSize)") >= 15, "Mobile hero lead must remain readable"
            mobile_logo = visitor.locator(".marketing-hero-logo").bounding_box()
            mobile_title = visitor.locator(".marketing-hero-identity h1").bounding_box()
            assert mobile_logo and mobile_title and mobile_logo["width"] >= 50, "Mobile logo must remain clearly visible"
            assert mobile_title["x"] >= mobile_logo["x"] + mobile_logo["width"] + 8, "Mobile logo must not overlap heading"
            assert visitor.locator(".marketing-footer-home-main").is_visible(), "Mobile home footer must remain visible"
            assert visitor.locator(".marketing-footer-home-links").count() == 2, "Mobile footer must retain both navigation groups"
            assert visitor.locator(".marketing-project-outro-icon").count() == 0, "Decorative star must stay removed on mobile"
        if page_name == "features":
            assert visitor.locator(".marketing-feature-item").count() == 7, "All seven mobile feature descriptions must remain"
            for grid in visitor.locator(".marketing-feature-items-cards").all():
                columns = grid.evaluate("(el) => getComputedStyle(el).gridTemplateColumns")
                assert len(columns.split()) == 1, f"Mobile features must use one column, got {columns}"
            assert visitor.locator(".marketing-feature-item-copy p").first.evaluate("(el) => parseFloat(getComputedStyle(el).fontSize)") >= 14, "Mobile feature descriptions must stay readable"
        if page_name == "help":
            form_size = visitor.locator(".marketing-form-card input").first.evaluate("(el) => parseFloat(getComputedStyle(el).fontSize)")
            assert form_size >= 16, f"Mobile form triggers iOS zoom: {form_size}"
            faq_mobile = visitor.locator(".marketing-help-questions").bounding_box()
            contact_mobile = visitor.locator(".marketing-help-contact").bounding_box()
            assert faq_mobile and contact_mobile and contact_mobile["y"] >= faq_mobile["y"] + faq_mobile["height"] - 2, "Help sections must stack on mobile"
            assert visitor.locator(".marketing-faq details").count() == 5
            assert visitor.locator(".marketing-help-contact form.lektrus-feedback-form").count() == 1
            assert len(visitor.locator(".marketing-help-layout").evaluate("(el) => getComputedStyle(el).gridTemplateColumns").split()) == 1, "Mobile help layout must be single-column"
        visitor.screenshot(path=str(root / ("10-phone-" + page_name + ".png")), full_page=True)

    visitor.goto("http://127.0.0.1:5173/#home", wait_until="domcontentloaded")
    assert visitor.locator(".marketing-menu-toggle").is_visible()
    assert not shortcuts.first.is_visible(), "Closed mobile menu must fully hide tools"
    visitor.locator(".marketing-menu-toggle").click()
    assert visitor.locator(".marketing-menu-toggle").get_attribute("aria-expanded") == "true"
    assert shortcuts.first.is_visible() and shortcuts.nth(1).is_visible()
    assert visitor.locator("#marketing-nav a").count() == 4
    visitor.keyboard.press("Escape")
    assert visitor.locator(".marketing-menu-toggle").get_attribute("aria-expanded") == "false"
    visitor.locator(".marketing-menu-toggle").click()
    visitor.locator(".marketing-sidebar-backdrop").click(position={"x": 370, "y": 200})
    assert visitor.locator(".marketing-menu-toggle").get_attribute("aria-expanded") == "false"
    assert visitor.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    visitor.set_viewport_size({"width": 320, "height": 568})
    visitor.goto("http://127.0.0.1:5173/#home", wait_until="domcontentloaded")
    visitor.locator(".marketing-hero-identity").wait_for()
    assert visitor.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Smallest supported phone must not scroll horizontally"
    tiny_logo = visitor.locator(".marketing-hero-logo").bounding_box()
    tiny_title = visitor.locator("#marketing-title").bounding_box()
    assert tiny_logo and tiny_title and tiny_logo["width"] >= 48, "Logo disappears on 320px phone"
    assert tiny_title["x"] >= tiny_logo["x"] + tiny_logo["width"] + 7, "Logo overlaps text at 320px"
    visitor.screenshot(path=str(root / "11-phone-320-logo.png"), full_page=True)
    visitor.close()
    browser.close()

print("Site studio browser PASS: four compact public tabs, faster genuine capture animation, project story on Home, prose-only Features, old URLs redirected, responsive desktop/mobile, and existing Site Studio editing.")
