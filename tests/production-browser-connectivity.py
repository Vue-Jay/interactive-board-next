"""Read-only live browser probe. No credentials, accounts or private boards."""
import json
from playwright.sync_api import sync_playwright, expect

ORIGIN = "https://lektrus.ru"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1440,"height":900})
    failures = []
    page.on("requestfailed", lambda request: failures.append({"url":request.url.split("?")[0],"failure":request.failure}))
    response=page.goto(ORIGIN+"/app?section=boards",wait_until="domcontentloaded",timeout=45000)
    assert response and response.status==200, ("app HTTP", response.status if response else None)
    expect(page.get_by_label("Email",exact=True)).to_be_visible(timeout=45000)
    result=page.evaluate("""async () => {
      const request=async path=>{
        try {const r=await fetch(path,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(20000)});
          let data=null; try{data=await r.json()}catch{}
          return {status:r.status,ok:r.ok,contentType:r.headers.get('content-type'),apiOK:data?.ok===true}
        } catch(e){return {error:String(e)}}
      };
      return {origin:location.origin,health:await request('/api/v1/health'),boards:await request('/api/v1/boards')};
    }""")
    print(json.dumps({"browser":result,"failedRequests":failures},ensure_ascii=False))
    assert result["origin"]==ORIGIN, result
    assert result["health"].get("status")==200 and result["health"].get("apiOK"), result
    assert result["boards"].get("status") in (401,403), result
    # The synthetic UUID is used only to verify SPA routing while signed out.
    deep=page.goto(ORIGIN+"/board/00000000-0000-4000-8000-000000000000",wait_until="domcontentloaded",timeout=45000)
    assert deep and deep.status==200, ("deep link HTTP",deep.status if deep else None)
    expect(page.get_by_label("Email",exact=True)).to_be_visible(timeout=45000)
    print("Live Chrome: application shell, API health, protected boards endpoint and direct-link sign-in are reachable")
    browser.close()
