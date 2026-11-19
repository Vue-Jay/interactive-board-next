"""Disposable database tests for plan enforcement and financial separation."""
import asyncio
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
import pytest
from app import app
from test_api import client, sign_in, TEACHER, STUDENT, OUTSIDER

@pytest.mark.asyncio
async def test_free_concurrent_board_limit_manual_pro_and_downgrade(client):
    _, owner = await sign_in(client,"teacher@example.test")
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1",OUTSIDER)
    _, admin = await sign_in(client,"outsider@example.test")
    url="/api/v1/boards"
    requests=await asyncio.gather(*(client.post(url,headers=owner,json={"title":f"Board {i}"}) for i in range(6)))
    assert sorted(r.status_code for r in requests)==[201]*5+[409]
    blocked=next(r for r in requests if r.status_code==409)
    assert blocked.json()["detail"]["resource"]=="boards"
    usage=(await client.get("/api/v1/billing",headers=owner)).json()
    assert usage["plan"]=="free" and usage["usage"]["boards"]==5
    grant=f"/api/v1/admin/users/{TEACHER}/subscription"
    until=(datetime.now(timezone.utc)+timedelta(days=30)).isoformat()
    assert (await client.patch(grant,headers=admin,json={"plan":"pro","until":until})).status_code==200
    new=await client.post(url,headers=owner,json={"title":"Pro extra"})
    assert new.status_code==201,new.text
    board_id=new.json()["id"]
    assert (await client.get("/api/v1/billing",headers=owner)).json()["unlimited"]
    assert (await client.patch(grant,headers=admin,json={"plan":"free"})).status_code==200
    usage=(await client.get("/api/v1/billing",headers=owner)).json()
    assert len(usage["boards"])==6 and sum(b["active"] for b in usage["boards"])==5
    archived=next(b for b in usage["boards"] if not b["active"])
    path=f"/api/v1/boards/{archived['id']}"
    assert (await client.get(path,headers=owner)).json()["plan_read_only"]
    blocked=await client.put(path+"/document",headers=owner,json={"expected_version":0,"document":{"version":1,"items":[]}})
    assert blocked.status_code==409,blocked.text
    chosen=[archived["id"]]+[b["id"] for b in usage["boards"] if b["active"]][:4]
    assert (await client.put("/api/v1/billing/active-boards",headers=owner,json={"board_ids":chosen})).status_code==200
    assert not (await client.get(path,headers=owner)).json()["plan_read_only"]
    assert (await client.put(path+"/document",headers=owner,json={"expected_version":0,"document":{"version":1,"items":[]}})).status_code==200

@pytest.mark.asyncio
async def test_group_and_storage_limits(client):
    _, owner=await sign_in(client,"teacher@example.test")
    group="/api/v1/organization/category"
    assert (await client.post(group,headers=owner,json={"kind":"group","name":"A"})).status_code==200
    rejected=await client.post(group,headers=owner,json={"kind":"group","name":"B"})
    assert rejected.status_code==409 and rejected.json()["detail"]["resource"]=="groups"
    board=(await client.post("/api/v1/boards",headers=owner,json={"title":"Board"})).json()["id"]
    async with app.state.pool.acquire() as conn:
        for i in range(10):
            await conn.execute("""INSERT INTO board_assets(board_id,asset_id,storage_name,content_type,size_bytes,sha256,created_by)
                VALUES($1,$2,$3,'application/pdf',26214400,$4,$5)""",UUID(board),str(i),uuid4(),"0"*64,TEACHER)
        with pytest.raises(Exception,match="LEKTRUS_PLAN:storage"):
            await conn.execute("""INSERT INTO board_assets(board_id,asset_id,storage_name,content_type,size_bytes,sha256,created_by)
                VALUES($1,'extra',$2,'application/pdf',1,$3,$4)""",UUID(board),uuid4(),"0"*64,TEACHER)
    assert (await client.get("/api/v1/billing",headers=owner)).json()["usage"]["storage_bytes"]==262144000

@pytest.mark.asyncio
async def test_finance_admin_only_and_manual_grants_not_revenue(client):
    from finance import settle_verified_order
    _, owner=await sign_in(client,"teacher@example.test")
    start=datetime.now(timezone.utc).date().isoformat()
    end=(datetime.now(timezone.utc).date()+timedelta(days=1)).isoformat()
    url=f"/api/v1/admin/finance?start={start}&end={end}"
    assert (await client.get(url,headers=owner)).status_code==403
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET is_admin=true WHERE id=$1",OUTSIDER)
    _, admin=await sign_in(client,"outsider@example.test")
    assert (await client.patch(f"/api/v1/admin/users/{TEACHER}/subscription",headers=admin,
        json={"plan":"pro","until":(datetime.now(timezone.utc)+timedelta(days=30)).isoformat()})).status_code==200
    entry={"transaction_date":start,"category":"amvera_expense","amount_kopecks":12500,"description":"Hosting"}
    assert (await client.post("/api/v1/admin/finance/entries",headers=admin,json=entry)).status_code==201
    assert (await client.post("/api/v1/admin/finance/amvera-balance",headers=admin,json={"balance_kopecks":50000})).status_code==201
    report=(await client.get(url,headers=admin)).json()
    assert report["totals"]["sales"]==0 and report["totals"]["net"]==-12500
    assert report["balance"]["balance_kopecks"]==50000
    assert len(report["subscriptions"])==1 and len(report["grants"])==1
    assert not (await client.get("/api/v1/billing/checkout-status",headers=owner)).json()["enabled"]
    order=uuid4()
    async with app.state.pool.acquire() as conn:
        await conn.execute("INSERT INTO billing_orders(id,user_id,period,amount_kopecks,provider) VALUES($1,$2,'month',29900,'test')",order,TEACHER)
        with pytest.raises(ValueError):
            await settle_verified_order(conn,order,"test","p1",1,"RUB")
        first=await settle_verified_order(conn,order,"test","p1",29900,"RUB")
        assert await settle_verified_order(conn,order,"test","p1",29900,"RUB")==first
    report=(await client.get(url,headers=admin)).json()
    assert report["totals"]["sales"]==29900 and report["totals"]["net"]==17400

@pytest.mark.asyncio
async def test_pro_storage_limit(client):
    _, owner=await sign_in(client,"teacher@example.test")
    async with app.state.pool.acquire() as conn:
        await conn.execute("UPDATE account_users SET subscription_plan='pro',subscription_until=now()+interval '1 day' WHERE id=$1",TEACHER)
    board=(await client.post("/api/v1/boards",headers=owner,json={"title":"Pro storage"})).json()["id"]
    async with app.state.pool.acquire() as conn:
        await conn.executemany("""INSERT INTO board_assets(board_id,asset_id,storage_name,content_type,size_bytes,sha256,created_by)
            VALUES($1,$2,$3,'application/pdf',$4,$5,$6)""",
            [(UUID(board),str(i),uuid4(),52428800,"0"*64,TEACHER) for i in range(102)])
        await conn.execute("""INSERT INTO board_assets(board_id,asset_id,storage_name,content_type,size_bytes,sha256,created_by)
            VALUES($1,'fill',$2,'application/pdf',20971520,$3,$4)""", UUID(board),uuid4(),"0"*64,TEACHER)
        with pytest.raises(Exception,match="LEKTRUS_PLAN:storage_pro"):
            await conn.execute("""INSERT INTO board_assets(board_id,asset_id,storage_name,content_type,size_bytes,sha256,created_by)
                VALUES($1,'extra',$2,'application/pdf',1,$3,$4)""",UUID(board),uuid4(),"0"*64,TEACHER)
    assert (await client.get("/api/v1/billing",headers=owner)).json()["usage"]["storage_bytes"]==5368709120
