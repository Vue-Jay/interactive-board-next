"""Payment-ready ledger. No public checkout or webhook before a provider is configured."""
from datetime import date, timedelta
import os
from typing import Literal, Protocol
from uuid import uuid4, UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

PRICES = {"month": 29900, "year": 299000}

class PaymentAdapter(Protocol):
    name: str
    async def checkout_url(self, order_id: UUID, amount_kopecks: int, currency: str) -> str: ...
    async def verify_webhook(self, request: Request) -> tuple[UUID, str, int, str]: ...

async def prepare_order(conn, user_id: UUID, period: str, adapter: PaymentAdapter):
    """Persist a price snapshot before contacting the provider. Call only when checkout is enabled."""
    if period not in PRICES:
        raise ValueError("Unknown subscription period")
    order_id = uuid4()
    await conn.execute("""INSERT INTO billing_orders(id,user_id,period,amount_kopecks,provider)
        VALUES($1,$2,$3,$4,$5)""",order_id,user_id,period,PRICES[period],adapter.name)
    # Provider must use order_id as its idempotency key; no access until settlement.
    return order_id, await adapter.checkout_url(order_id,PRICES[period],"RUB")

# The adapter must verify provider signature AND authoritative payment status,
# merchant account, amount/currency and order id before calling this function.
# Never call from a browser request or unverified webhook.
async def settle_verified_order(conn, order_id: UUID, provider: str, payment_id: str, amount: int, currency: str):
    async with conn.transaction():
        order = await conn.fetchrow("SELECT * FROM billing_orders WHERE id=$1 FOR UPDATE", order_id)
        if not order or order["provider"] != provider or order["amount_kopecks"] != amount or currency != "RUB":
            raise ValueError("Payment does not match order")
        if order["status"] == "paid" and order["provider_payment_id"] == payment_id:
            return order["entitlement_until"]
        if order["status"] != "pending" or not order["user_id"] or (order["provider_payment_id"] and order["provider_payment_id"] != payment_id):
            raise ValueError("Order cannot be settled")
        until = await conn.fetchval("""UPDATE account_users SET subscription_plan='pro',
            subscription_until=greatest(now(),coalesce(subscription_until,now()))+
              CASE WHEN $2='year' THEN interval '1 year' ELSE interval '1 month' END,
            subscription_granted_by=NULL,subscription_updated_at=now()
            WHERE id=$1 RETURNING subscription_until""", order["user_id"],order["period"])
        await conn.execute("""UPDATE billing_orders SET status='paid',provider_payment_id=$2,
            paid_at=now(),entitlement_until=$3 WHERE id=$1""", order_id,payment_id,until)
        return until

Category = Literal["amvera_expense","amvera_topup","other_expense","other_income","refund","payment_fee","tax"]
class Entry(BaseModel):
    transaction_date: date
    category: Category
    amount_kopecks: int = Field(gt=0,le=100000000000)
    description: str = Field(min_length=1,max_length=500)
class Checkout(BaseModel):
    period: Literal['month','year']

class Balance(BaseModel):
    balance_kopecks: int = Field(ge=-100000000000,le=100000000000)

def make_finance_router(current_user):
    router = APIRouter(prefix="/api/v1")
    def admin(user):
        if not user["is_admin"]:
            raise HTTPException(403,"Только для администратора.")

    def configured_adapter(request):
        adapter = getattr(request.app.state,"payment_adapter",None)
        return adapter if os.getenv("LEKTRUS_PAYMENTS_ENABLED","").lower()=="true" else None

    @router.get("/billing/checkout-status")
    async def checkout_status(request: Request, user=Depends(current_user)):
        return {"enabled": configured_adapter(request) is not None, "currency": "RUB", "prices": PRICES}

    @router.post("/billing/checkout",status_code=201)
    async def checkout(data: Checkout, request: Request, user=Depends(current_user)):
        adapter = configured_adapter(request)
        if not adapter:
            raise HTTPException(503,"Подключение оплаты скоро.")
        if user["guest_board_id"]:
            raise HTTPException(403,"Подписка доступна зарегистрированным пользователям.")
        async with request.app.state.pool.acquire() as conn:
            ident,url = await prepare_order(conn,user["id"],data.period,adapter)
        return {"order_id":ident,"checkout_url":url}

    @router.post("/billing/webhook/{provider}")
    async def webhook(provider: str, request: Request):
        adapter = configured_adapter(request)
        if not adapter or provider != adapter.name:
            raise HTTPException(404,"Платёжный провайдер не подключён.")
        try:
            order_id,payment_id,amount,currency = await adapter.verify_webhook(request)
            async with request.app.state.pool.acquire() as conn:
                await settle_verified_order(conn,order_id,provider,payment_id,amount,currency)
        except ValueError:
            raise HTTPException(400,"Платёж не подтверждён.")
        return {"ok":True}

    @router.get("/admin/finance")
    async def report(request: Request, start: date, end: date, user=Depends(current_user)):
        admin(user)
        if end < start or end-start > timedelta(days=366):
            raise HTTPException(422,"Выберите период до одного года.")
        async with request.app.state.pool.acquire() as conn, conn.transaction(isolation="repeatable_read", readonly=True):
            entries = await conn.fetch("""SELECT * FROM finance_entries WHERE transaction_date BETWEEN $1 AND $2
                ORDER BY transaction_date DESC,created_at DESC""",start,end)
            orders = await conn.fetch("""SELECT o.*,u.email,u.display_name FROM billing_orders o LEFT JOIN account_users u ON u.id=o.user_id
                WHERE (o.created_at AT TIME ZONE 'Asia/Yekaterinburg')::date BETWEEN $1 AND $2
                   OR (o.paid_at AT TIME ZONE 'Asia/Yekaterinburg')::date BETWEEN $1 AND $2
                ORDER BY o.created_at DESC""",start,end)
            paid = await conn.fetchval("""SELECT coalesce(sum(amount_kopecks),0)::bigint FROM billing_orders
                WHERE paid_at IS NOT NULL AND (paid_at AT TIME ZONE 'Asia/Yekaterinburg')::date BETWEEN $1 AND $2""",start,end)
            active = await conn.fetch("""SELECT id,display_name,email,subscription_until,subscription_granted_by
                FROM account_users WHERE subscription_plan='pro' AND subscription_until>now()
                AND guest_board_id IS NULL ORDER BY subscription_until""")
            grants = await conn.fetch("""SELECT g.*,u.email FROM billing_grant_events g LEFT JOIN account_users u ON u.id=g.user_id
                WHERE (happened_at AT TIME ZONE 'Asia/Yekaterinburg')::date BETWEEN $1 AND $2 ORDER BY happened_at DESC""",start,end)
            balance = await conn.fetchrow("SELECT balance_kopecks,recorded_at FROM finance_amvera_balances ORDER BY recorded_at DESC LIMIT 1")
            balances = await conn.fetch("""SELECT balance_kopecks,recorded_at FROM finance_amvera_balances WHERE
                (recorded_at AT TIME ZONE 'Asia/Yekaterinburg')::date BETWEEN $1 AND $2 ORDER BY recorded_at""",start,end)
        by_day = {}
        for entry in entries:
            key = entry["transaction_date"].isoformat()
            item = by_day.setdefault(key,{"date":key,"income":0,"expenses":0,"topups":0})
            category, amount = entry["category"],entry["amount_kopecks"]
            item["income" if category=="other_income" else "topups" if category=="amvera_topup" else "expenses"] += amount
        for order in orders:
            if order["paid_at"]:
                from zoneinfo import ZoneInfo
                key = order["paid_at"].astimezone(ZoneInfo("Asia/Yekaterinburg")).date().isoformat()
                if start.isoformat() <= key <= end.isoformat():
                    by_day.setdefault(key,{"date":key,"income":0,"expenses":0,"topups":0})["income"] += order["amount_kopecks"]
        totals = {"sales":paid,"other_income":sum(x["amount_kopecks"] for x in entries if x["category"]=="other_income"),
            "expenses":sum(x["amount_kopecks"] for x in entries if x["category"] not in ("other_income","amvera_topup")),
            "amvera_expenses":sum(x["amount_kopecks"] for x in entries if x["category"]=="amvera_expense"),
            "topups":sum(x["amount_kopecks"] for x in entries if x["category"]=="amvera_topup")}
        totals["net"]=totals["sales"]+totals["other_income"]-totals["expenses"]
        return {"totals":totals,"entries":[dict(x) for x in entries],"orders":[dict(x) for x in orders],
            "subscriptions":[dict(x) for x in active],"grants":[dict(x) for x in grants],"balance":dict(balance) if balance else None,
            "daily":sorted(by_day.values(),key=lambda x:x["date"]),"balances":[dict(x) for x in balances],
            "checkout_enabled":configured_adapter(request) is not None}

    @router.post("/admin/finance/entries", status_code=201)
    async def add_entry(data: Entry, request: Request, user=Depends(current_user)):
        admin(user)
        if not data.description.strip():
            raise HTTPException(422,"Укажите назначение операции.")
        async with request.app.state.pool.acquire() as conn:
            await conn.execute("""INSERT INTO finance_entries(id,transaction_date,category,amount_kopecks,description,created_by)
                VALUES($1,$2,$3,$4,$5,$6)""",uuid4(),data.transaction_date,data.category,data.amount_kopecks,data.description.strip(),user["id"])
        return {"ok":True}

    @router.post("/admin/finance/amvera-balance",status_code=201)
    async def add_balance(data:Balance,request:Request,user=Depends(current_user)):
        admin(user)
        async with request.app.state.pool.acquire() as conn:
            await conn.execute("INSERT INTO finance_amvera_balances(id,balance_kopecks,created_by) VALUES($1,$2,$3)",
                uuid4(),data.balance_kopecks,user["id"])
        return {"ok":True}

    return router
