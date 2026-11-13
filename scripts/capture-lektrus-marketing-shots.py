#!/usr/bin/env python3
"""Capture the eight approved Lektrus showcase topics from the REAL running UI.

Run only against an isolated local Vite server. Never connect a production
account or read user boards; all subjects are deterministic /demo/board scenes.
"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE="http://127.0.0.1:5173"
OUT=Path("public/site")
SCENES=(
    ("math", "board-math.png", "Функция и её график"),
    ("chemistry", "board-chemistry.png", "Химическая лаборатория"),
    ("geometry", "board-geometry.png", "Геометрическое исследование"),
    ("physics", "board-physics.png", "Электрическая цепь"),
    ("contour", "board-contour.png", "Контурная карта Европы"),
    ("history", "board-history.png", "Европа в 1914 году"),
    ("russian", "board-russian.png", "Фонетический разбор"),
)

def settle(page):
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(2400)

def save(page, filename):
    path=OUT/filename
    page.screenshot(path=str(path), animations="disabled", full_page=False)
    data=path.read_bytes()
    assert data.startswith(b"\\x89PNG\\r\\n\\x1a\\n") and len(data)>30_000, f"Invalid capture: {filename}"
    print(f"CAPTURE {filename} ({len(data)} bytes)", flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
    context=browser.new_context(viewport={"width":1600,"height":1000},
      device_scale_factor=1,color_scheme="light",reduced_motion="reduce",
      locale="ru-RU",timezone_id="Europe/Moscow")
    page=context.new_page()
    for scene,filename,label in SCENES:
        page.goto(BASE+"/demo/board?scene="+scene+"&capture=1",wait_until="domcontentloaded",timeout=45000)
        page.locator(".board-title").wait_for(timeout=45000)
        page.get_by_text(label,exact=True).first.wait_for(timeout=30000)
        settle(page)
        save(page,filename)

    # A fresh, entirely LOCAL teaching workspace, never a production user.
    page.goto(BASE+"/app",wait_until="domcontentloaded")
    boards=page.evaluate("""async () => {
      const auth=await import('/src/authStore.ts');
      const store=await import('/src/boardStore.ts');
      const user=await auth.registerUser({
        name:'Преподаватель',email:'showcase@lektrus.invalid',password:'local-only-test'
      });
      if (!user) throw Error('Cannot seed isolated capture account');
      const math=await store.createBoard(user,'Алгебра',true);
      const physics=await store.createBoard(user,'Физика',true);
      const preview=await import('/src/boardPreview.ts');
      for (const [board,source] of [[math,'board-math.png'],[physics,'board-physics.png']]) {
        const img=new Image();
        img.src='/site/'+source;
        await img.decode();
        const canvas=document.createElement('canvas');
        canvas.width=320; canvas.height=180;
        canvas.getContext('2d').drawImage(img,0,0,320,180);
        preview.cacheBoardPreview(board.id,canvas.toDataURL('image/webp',.52));
      }
      return [math.id,physics.id];
    }""")
    assert len(boards)==2
    page.reload(wait_until="domcontentloaded")
    page.get_by_text("Всё для ваших занятий").first.wait_for(timeout=45000)
    page.get_by_text("Алгебра").first.wait_for(timeout=45000)
    page.get_by_text("Физика").first.wait_for(timeout=45000)
    settle(page)
    save(page,"app-home.png")
    browser.close()

print("All eight genuine UI screenshots captured.",flush=True)
