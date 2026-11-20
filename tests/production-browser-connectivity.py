"""Read-only live browser probe. No credentials, accounts or private boards."""
import json
from playwright.sync_api import sync_playwright, expect

ORIGIN = "https://lektrus.ru"

def verify_protected_boards(maintenance, boards):
    """Distinguish explicit, intentional maintenance from a generic outage."""
    assert maintenance.get("status") == 200, maintenance
    state = maintenance.get("maintenanceState")
    assert state in ("off", "scheduled", "active"), maintenance
    if state == "active":
        assert maintenance.get("accessAllowed") is False, maintenance
        assert boards.get("status") == 503 and boards.get("code") == "maintenance", boards
    else:
        assert maintenance.get("accessAllowed") is True, maintenance
        assert boards.get("status") in (401, 403), boards


def verify_contract():
    # Exercise both valid modes and reject unrelated outages and access leaks.
    for state in ("off", "scheduled"):
        verify_protected_boards({"status": 200, "maintenanceState": state, "accessAllowed": True}, {"status": 401})
    active = {"status": 200, "maintenanceState": "active", "accessAllowed": False}
    verify_protected_boards(active, {"status": 503, "code": "maintenance"})
    for policy, response in (
        (active, {"status": 503}),
        (active, {"status": 503, "code": "upstream_unavailable"}),
        (active, {"status": 200}),
        (active, {"status": 401}),
        ({"status": 200, "maintenanceState": "off", "accessAllowed": True}, {"status": 503, "code": "maintenance"}),
        ({"status": 503}, {"status": 503, "code": "maintenance"}),
        ({"status": 200, "maintenanceState": "active", "accessAllowed": True}, {"status": 503, "code": "maintenance"}),
    ):
        try:
            verify_protected_boards(policy, response)
        except AssertionError:
            continue
        raise AssertionError(("Invalid response accepted", policy, response))


verify_contract()

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
          return {status:r.status,ok:r.ok,contentType:r.headers.get('content-type'),apiOK:data?.ok===true,maintenanceState:data?.state,accessAllowed:data?.access_allowed,code:data?.code}
        } catch(e){return {error:String(e)}}
      };
      return {origin:location.origin,health:await request('/api/v1/health'),maintenance:await request('/api/v1/maintenance'),boards:await request('/api/v1/boards')};
    }""")
    print(json.dumps({"browser":result,"failedRequests":failures},ensure_ascii=False))
    assert result["origin"]==ORIGIN, result
    assert result["health"].get("status")==200 and result["health"].get("apiOK"), result
    verify_protected_boards(result["maintenance"], result["boards"])
    if result["maintenance"]["maintenanceState"] == "active":
        expect(page.get_by_role("status", name="Технические работы")).to_be_visible(timeout=45000)
    # The synthetic UUID is used only to verify SPA routing while signed out.
    deep=page.goto(ORIGIN+"/board/00000000-0000-4000-8000-000000000000",wait_until="domcontentloaded",timeout=45000)
    assert deep and deep.status==200, ("deep link HTTP",deep.status if deep else None)
    if result["maintenance"]["maintenanceState"] == "active":
        expect(page.get_by_role("heading", name="Скоро вернёмся", exact=True)).to_be_visible(timeout=45000)
        expect(page.get_by_label("Email", exact=True)).not_to_be_visible()
    else:
        expect(page.get_by_label("Email", exact=True)).to_be_visible(timeout=45000)
    print("Live Chrome: application shell, API health, protected boards endpoint (including verified maintenance) and the expected direct-link screen are reachable")
    browser.close()
