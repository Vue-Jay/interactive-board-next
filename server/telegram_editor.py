"""Admin-only Telegram editorial queue; credentials never leave the server."""
import asyncio
import base64
import logging
import os
import re
from datetime import datetime, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from admin import require_admin
from maintenance import phase

log = logging.getLogger(__name__)
# Telegram's Bot API URL embeds the token; never enable HTTP request logging.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
COLUMNS = "id,source_kind,text,status,scheduled_at,created_at,updated_at,sent_at,telegram_message_id,error,had_image,(image_data IS NOT NULL) AS has_image"


def channel():
    return os.getenv("LEKTRUS_TELEGRAM_CHANNEL", "@lektrus").strip().lower()


def telegram_enabled():
    return bool(re.fullmatch(r"[0-9]+:[A-Za-z0-9_-]+", os.getenv("LEKTRUS_TELEGRAM_BOT_TOKEN", "")) and
                re.fullmatch(r"@[a-z0-9_]{5,32}", channel()))


def ai_key():
    return os.getenv("LEKTRUS_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") or ""


def ai_model(kind):
    return os.getenv("LEKTRUS_OPENAI_" + kind.upper() + "_MODEL", "").strip()


class Rejected(Exception):
    pass


class Unknown(Exception):
    pass


async def telegram_api(method, **kwargs):
    if not telegram_enabled():
        raise Rejected("Telegram не настроен на сервере.")
    token = os.environ["LEKTRUS_TELEGRAM_BOT_TOKEN"]
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=False, trust_env=False) as client:
            response = await client.post(f"https://api.telegram.org/bot{token}/{method}", **kwargs)
            data = response.json()
    except (httpx.HTTPError, ValueError):
        raise Unknown("Ответ Telegram не получен. Проверьте канал вручную.") from None
    if response.status_code >= 500:
        raise Unknown("Telegram временно недоступен. Проверьте канал вручную.")
    if not response.is_success or not data.get("ok"):
        raise Rejected(f"Telegram отклонил запрос ({response.status_code}). Проверьте права бота.")
    return data["result"]


async def check_bot(chat_id=None, bot_id=None):
    try:
        me = await telegram_api("getMe", json={})
        chat = await telegram_api("getChat", json={"chat_id": channel() if chat_id is None else chat_id})
        if chat.get("type") != "channel" or ("@" + chat.get("username", "").lower()) != channel():
            raise Rejected("Указанный канал не совпадает с настройкой сервера.")
        if bot_id is not None and me["id"] != bot_id:
            raise Rejected("Бот изменился. Повторно подтвердите подключение.")
        member = await telegram_api("getChatMember", json={"chat_id": chat["id"], "user_id": me["id"]})
        if member["status"] != "creator" and not (member["status"] == "administrator" and member.get("can_post_messages")):
            raise Rejected("Боту нужны права администратора на публикацию сообщений.")
        return chat, me
    except Unknown:
        raise Rejected("Не удалось проверить доступ Telegram. Попробуйте позже.") from None


def verified(settings):
    return bool(telegram_enabled() and settings["verified_chat_id"] and settings["verified_channel"] == channel())


def normalized(text, image=False):
    text = text.strip()
    if not text or len(text.encode("utf-16-le")) // 2 > (1000 if image else 3500):
        raise HTTPException(422, "Текст должен содержать от 1 до " + ("1000" if image else "3500") + " символов.")
    return text


async def openai_json(path, payload):
    if not ai_key():
        raise HTTPException(503, "Ключ OpenAI ещё не настроен.")
    try:
        async with httpx.AsyncClient(timeout=150, follow_redirects=False, trust_env=False) as client:
            res = await client.post("https://api.openai.com/v1/" + path, json=payload,
                                    headers={"Authorization": "Bearer " + ai_key()})
            res.raise_for_status()
            return res.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "OpenAI не ответил. Проверьте ключ, модель и баланс API.") from None


async def reserve_generation(pool, kind):
    if not ai_key() or not ai_model(kind):
        raise HTTPException(503, "Настройте ключ и модель OpenAI на сервере.")
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute("SELECT pg_advisory_xact_lock(746210)")
        await conn.execute("DELETE FROM telegram_generation_attempts WHERE created_at < now()-interval '2 days'")
        count = await conn.fetchval("SELECT count(*) FROM telegram_generation_attempts WHERE kind=$1 AND created_at > now()-interval '24 hours'", kind)
        if count >= (10 if kind == "text" else 3):
            raise HTTPException(429, "Дневной лимит генерации исчерпан. Попробуйте позже.")
        await conn.execute("INSERT INTO telegram_generation_attempts(kind) VALUES($1)", kind)


class PostInput(BaseModel):
    text: str = Field(min_length=1, max_length=3500)


class GenerateInput(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)


class ScheduleInput(BaseModel):
    publish_at: datetime | None = None


class SettingsInput(BaseModel):
    auto_news: bool = False
    auto_maintenance: bool = False
    auto_publish: bool = False


async def collect_automatic(pool):
    async with pool.acquire() as conn, conn.transaction():
        settings = await conn.fetchrow("SELECT * FROM telegram_editor_settings WHERE singleton FOR UPDATE")
        auto = settings["auto_publish"] and verified(settings)
        async def add(key, kind, text):
            await conn.execute("""INSERT INTO telegram_posts(source_key,source_kind,text,status,scheduled_at,auto_queued)
                VALUES($1,$2,$3,$4,CASE WHEN $5 THEN now() ELSE NULL END,$5) ON CONFLICT(source_key) DO NOTHING""",
                key, kind, text, "scheduled" if auto else "draft", auto)
        if settings["auto_news"]:
            rows = await conn.fetch("""SELECT id,title,summary,published_at FROM site_news n
                WHERE published_at >= $1 AND NOT EXISTS (SELECT 1 FROM telegram_posts p WHERE p.source_key='news:'||n.id::text||':'||extract(epoch FROM n.published_at)::text)
                ORDER BY published_at LIMIT 10""", settings["news_since"])
            for row in rows:
                # PostgreSQL epoch emits a stable decimal representation.
                key = await conn.fetchval("SELECT 'news:'||$1::uuid::text||':'||extract(epoch FROM $2::timestamptz)::text", row["id"], row["published_at"])
                await add(key, "news", row["title"] + "\n\n" + row["summary"] + "\n\nПодробнее: https://lektrus.ru/#news")
        if settings["auto_maintenance"]:
            policy = await conn.fetchrow("SELECT starts_at,ends_at,notice FROM service_maintenance WHERE singleton")
            state = phase(policy)
            previous = settings["maintenance_phase"]
            old_key = settings["maintenance_key"]
            key = policy["starts_at"].isoformat() if policy and policy["starts_at"] else None
            def fmt(value):
                return value.astimezone(ZoneInfo("Asia/Yekaterinburg")).strftime("%d.%m.%Y в %H:%M") + " (UTC+5)"
            if state != "off" and (state != previous or key != old_key):
                text = "🔧 Запланированы технические работы" if state == "scheduled" else "🔧 В Lektrus ведутся технические работы"
                text += "\n\nНачало: " + fmt(policy["starts_at"])
                if policy["ends_at"]:
                    text += "\nОкончание: " + fmt(policy["ends_at"])
                if policy["notice"]:
                    text += "\n\n" + policy["notice"]
                await add("maintenance:"+key+":"+state, "maintenance", text)
            elif state == "off" and previous in ("scheduled", "active") and old_key:
                await add("maintenance:"+old_key+":off", "maintenance",
                          "✅ Технические работы завершены. Lektrus снова доступен." if previous == "active" else "Запланированные технические работы отменены.")
            await conn.execute("UPDATE telegram_editor_settings SET maintenance_phase=$1,maintenance_key=$2 WHERE singleton", state, key)


async def deliver_one(pool):
    async with pool.acquire() as conn, conn.transaction():
        settings = await conn.fetchrow("SELECT * FROM telegram_editor_settings WHERE singleton FOR UPDATE")
        await conn.execute("""UPDATE telegram_posts SET status='unknown',error='Отправка прервалась. Проверьте канал вручную.',updated_at=now()
            WHERE status='sending' AND updated_at < now()-interval '5 minutes'""")
        if not verified(settings):
            return False
        row = await conn.fetchrow("""UPDATE telegram_posts SET status='sending',updated_at=now(),error=NULL
            WHERE id=(SELECT id FROM telegram_posts WHERE status='scheduled' AND scheduled_at<=now()
            ORDER BY scheduled_at,id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *""")
    if not row:
        return False
    status, message_id, error = "sent", None, None
    try:
        await check_bot(settings["verified_chat_id"], settings["verified_bot_id"])
        if row["image_data"]:
            result = await telegram_api("sendPhoto", data={"chat_id":str(settings["verified_chat_id"]),"caption":row["text"]},
                                        files={"photo":("lektrus.jpg",row["image_data"],"image/jpeg")})
        else:
            result = await telegram_api("sendMessage", json={"chat_id":settings["verified_chat_id"],"text":row["text"],
                                                            "link_preview_options":{"is_disabled":True}})
        message_id = int(result["message_id"])
    except Rejected as exc:
        status, error = "failed", str(exc)
    except (Unknown, KeyError, TypeError, ValueError):
        status, error = "unknown", "Не удалось подтвердить отправку. Проверьте канал вручную; автоматического повтора не будет."
    async with pool.acquire() as conn:
        await conn.execute("""UPDATE telegram_posts SET status=$2,telegram_message_id=$3,error=$4,
            sent_at=CASE WHEN $2='sent' THEN now() ELSE NULL END,
            image_data=CASE WHEN $2='sent' THEN NULL ELSE image_data END,updated_at=now() WHERE id=$1 AND status='sending'""",
            row["id"], status, message_id, error)
    return True


async def run_telegram_editor(pool):
    while True:
        try:
            await collect_automatic(pool)
            await deliver_one(pool)
        except Exception:
            log.warning("Telegram editor cycle failed; will check again")
        await asyncio.sleep(15)


def make_telegram_router(current_user):
    router = APIRouter(prefix="/api/v1/admin/telegram")

    async def authorized(user=Depends(current_user)):
        require_admin(user)

    async def row_response(conn, post_id):
        row = await conn.fetchrow(f"SELECT {COLUMNS} FROM telegram_posts WHERE id=$1", post_id)
        if not row:
            raise HTTPException(404, "Запись не найдена.")
        return dict(row)

    @router.get("", dependencies=[Depends(authorized)])
    async def overview(request: Request):
        async with request.app.state.pool.acquire() as conn:
            s = await conn.fetchrow("SELECT * FROM telegram_editor_settings WHERE singleton")
            rows = await conn.fetch(f"SELECT {COLUMNS} FROM telegram_posts ORDER BY created_at DESC,id DESC LIMIT 100")
        return {"channel":channel(),"configured":telegram_enabled(),"verified":verified(s),"bot_username":s["bot_username"],
                "ai_text":bool(ai_key() and ai_model("text")),"ai_image":bool(ai_key() and ai_model("image")),
                "auto_news":s["auto_news"],"auto_maintenance":s["auto_maintenance"],"auto_publish":s["auto_publish"],
                "posts":[dict(r) for r in rows]}

    @router.post("/verify", dependencies=[Depends(authorized)])
    async def verify(request: Request):
        try:
            chat, me = await check_bot()
        except Rejected as exc:
            raise HTTPException(409, str(exc)) from None
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            old = await conn.fetchrow("SELECT * FROM telegram_editor_settings WHERE singleton FOR UPDATE")
            if old["verified_chat_id"] != chat["id"] or old["verified_bot_id"] != me["id"]:
                await conn.execute("UPDATE telegram_posts SET status='draft',scheduled_at=NULL,auto_queued=false,updated_at=now() WHERE status='scheduled'")
                await conn.execute("UPDATE telegram_editor_settings SET auto_publish=false WHERE singleton")
            await conn.execute("""UPDATE telegram_editor_settings SET verified_chat_id=$1,verified_bot_id=$2,
                verified_channel=$3,bot_username=$4,verified_at=now() WHERE singleton""", chat["id"],me["id"],channel(),me.get("username"))
        return {"ok":True}

    @router.put("/settings", dependencies=[Depends(authorized)])
    async def settings(data: SettingsInput, request: Request):
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            old = await conn.fetchrow("SELECT * FROM telegram_editor_settings WHERE singleton FOR UPDATE")
            if data.auto_publish and not verified(old):
                raise HTTPException(409, "Сначала подтвердите подключение Telegram.")
            await conn.execute("""UPDATE telegram_editor_settings SET auto_news=$1,auto_maintenance=$2,auto_publish=$3,
                news_since=CASE WHEN $1 AND NOT auto_news THEN now() ELSE news_since END,
                maintenance_phase=CASE WHEN $2 AND NOT auto_maintenance THEN NULL ELSE maintenance_phase END WHERE singleton""",
                data.auto_news,data.auto_maintenance,data.auto_publish)
            await conn.execute("""UPDATE telegram_posts SET status='draft',scheduled_at=NULL,auto_queued=false,updated_at=now()
                WHERE status='scheduled' AND auto_queued AND (NOT $1 OR (source_kind='news' AND NOT $2) OR (source_kind='maintenance' AND NOT $3))""",
                data.auto_publish,data.auto_news,data.auto_maintenance)
        return {"ok":True}

    @router.post("/posts", status_code=201, dependencies=[Depends(authorized)])
    async def create(data: PostInput, request: Request):
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow(f"INSERT INTO telegram_posts(text) VALUES($1) RETURNING {COLUMNS}", normalized(data.text))
        return dict(row)

    @router.post("/generate", status_code=201, dependencies=[Depends(authorized)])
    async def generate(data: GenerateInput, request: Request):
        pool = request.app.state.pool
        await reserve_generation(pool, "text")
        result = await openai_json("responses", {"model":ai_model("text"),"store":False,"max_output_tokens":1200,
            "instructions":"Ты редактор официального Telegram-канала Lektrus, учебной платформы с интерактивной доской. Напиши короткий естественный пост на русском, без Markdown и выдуманных фактов, дат, тарифов или обещаний. Используй только предоставленные факты. Это черновик для редактора, не публикация.","input":data.prompt})
        text = "\n".join(c.get("text","") for o in result.get("output",[]) if o.get("type")=="message" for c in o.get("content",[]) if c.get("type")=="output_text")
        if not text.strip():
            raise HTTPException(502, "OpenAI не вернул текст.")
        async with pool.acquire() as conn:
            row = await conn.fetchrow(f"INSERT INTO telegram_posts(text) VALUES($1) RETURNING {COLUMNS}", normalized(text))
        return dict(row)

    @router.put("/posts/{post_id}", dependencies=[Depends(authorized)])
    async def edit(post_id: UUID, data: PostInput, request: Request):
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow("SELECT status,image_data IS NOT NULL AS has_image FROM telegram_posts WHERE id=$1 FOR UPDATE", post_id)
            if not row or row["status"] not in ("draft","failed"):
                raise HTTPException(409, "Редактировать можно только черновики и неотправленные записи.")
            await conn.execute("UPDATE telegram_posts SET text=$2,status='draft',error=NULL,updated_at=now() WHERE id=$1", post_id,normalized(data.text,row["has_image"]))
            return await row_response(conn,post_id)

    @router.post("/posts/{post_id}/schedule", dependencies=[Depends(authorized)])
    async def schedule(post_id: UUID, data: ScheduleInput, request: Request):
        at = data.publish_at or datetime.now(timezone.utc)
        if at.tzinfo is None:
            raise HTTPException(422, "Укажите часовой пояс.")
        async with request.app.state.pool.acquire() as conn, conn.transaction():
            s = await conn.fetchrow("SELECT * FROM telegram_editor_settings WHERE singleton FOR UPDATE")
            if not verified(s):
                raise HTTPException(409, "Сначала подтвердите подключение Telegram.")
            row = await conn.fetchrow("""UPDATE telegram_posts SET status='scheduled',scheduled_at=$2,auto_queued=false,error=NULL,updated_at=now()
                WHERE id=$1 AND status IN ('draft','failed') RETURNING id""",post_id,at)
            if not row:
                raise HTTPException(409, "Запись нельзя поставить в очередь.")
            return await row_response(conn,post_id)

    @router.post("/posts/{post_id}/cancel", dependencies=[Depends(authorized)])
    async def cancel(post_id: UUID, request: Request):
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow("""UPDATE telegram_posts SET status=CASE WHEN status='scheduled' THEN 'draft' ELSE 'cancelled' END,
                scheduled_at=NULL,auto_queued=false,updated_at=now() WHERE id=$1 AND status IN ('draft','scheduled','failed') RETURNING id""",post_id)
            if not row:
                raise HTTPException(409, "Запись уже отправляется или завершена.")
            return await row_response(conn,post_id)

    @router.post("/posts/{post_id}/image", dependencies=[Depends(authorized)])
    async def image(post_id: UUID, request: Request):
        pool = request.app.state.pool
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT text,status,updated_at FROM telegram_posts WHERE id=$1", post_id)
        if not row or row["status"] not in ("draft","failed"):
            raise HTTPException(409, "Изображение можно добавить только в черновик.")
        normalized(row["text"],True)
        await reserve_generation(pool,"image")
        result = await openai_json("images/generations", {"model":ai_model("image"),"size":"1024x1024","quality":"low",
            "output_format":"jpeg","prompt":"Иллюстрация к публикации образовательной платформы Lektrus. Современный минимализм, белый и синий цвета. Без текста, надписей и логотипов. Тема: "+row["text"]})
        try:
            img = base64.b64decode(result["data"][0]["b64_json"],validate=True)
            if not img.startswith(b"\xff\xd8") or len(img)>2097152:
                raise ValueError()
        except (KeyError, IndexError, TypeError, ValueError):
            raise HTTPException(502, "OpenAI не вернул подходящее изображение JPEG.") from None
        async with pool.acquire() as conn:
            updated = await conn.fetchrow("""UPDATE telegram_posts SET image_data=$2,had_image=true,updated_at=now()
                WHERE id=$1 AND status IN ('draft','failed') AND updated_at=$3 RETURNING id""", post_id,img,row["updated_at"])
            if not updated:
                raise HTTPException(409, "Черновик изменился. Изображение не прикреплено.")
            return await row_response(conn,post_id)

    @router.get("/posts/{post_id}/image", dependencies=[Depends(authorized)])
    async def preview(post_id: UUID, request: Request):
        async with request.app.state.pool.acquire() as conn:
            img = await conn.fetchval("SELECT image_data FROM telegram_posts WHERE id=$1",post_id)
        if not img:
            raise HTTPException(404,"Изображение не найдено.")
        return {"base64":base64.b64encode(img).decode("ascii")}

    @router.delete("/posts/{post_id}/image", dependencies=[Depends(authorized)])
    async def remove_image(post_id: UUID, request: Request):
        async with request.app.state.pool.acquire() as conn:
            row = await conn.fetchrow("""UPDATE telegram_posts SET image_data=NULL,had_image=false,updated_at=now()
                WHERE id=$1 AND status IN ('draft','failed') RETURNING id""",post_id)
            if not row:
                raise HTTPException(409,"Запись нельзя изменить.")
            return await row_response(conn,post_id)
    return router
