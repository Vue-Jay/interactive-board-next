"""Durable, bounded asynchronous delivery of support messages through Lektrus SMTP."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr, format_datetime
import logging
import os
import smtplib
import ssl

from invitations import normalize_email
from mail_templates import branded_email
from registration import server_mail_config
from fastapi import HTTPException

log = logging.getLogger(__name__)
MAX_ATTEMPTS = 3


def feedback_email_address(value: str) -> str:
    email = normalize_email(value)
    if any(c in email for c in ',;<>:"\\()[]'):
        raise HTTPException(422, "Введите один корректный email.")
    return email


def notification_recipient() -> str:
    # The service mailbox is the sender, not the administrator's inbox.
    value = os.getenv("LEKTRUS_FEEDBACK_TO", "").strip() or os.getenv("LEKTRUS_BOOTSTRAP_ADMIN_EMAIL", "").strip()
    return feedback_email_address(value) if value else ""


def build_feedback_email(row, sender: str, origin: str) -> EmailMessage:
    notification = row["kind"] == "notification"
    msg = EmailMessage()
    msg["From"] = formataddr(("Lektrus", sender))
    msg["To"] = feedback_email_address(row["recipient"])
    msg["Subject"] = row["subject"]
    msg["Date"] = format_datetime(datetime.now(timezone.utc))
    # A stable Message-ID also identifies retry attempts of the same delivery.
    msg["Message-ID"] = f'<feedback-{row["id"]}@{sender.rsplit("@", 1)[-1]}>'
    msg["Auto-Submitted"] = "auto-generated" if notification else "auto-replied"
    action = origin + "/app?section=admin&mail=1" if notification else ""
    msg.set_content(row["body"] + ("\n\nОткрыть администрирование: " + action if action else "") + "\n\nКоманда Lektrus")
    msg.add_alternative(branded_email(row["subject"], "Обратная связь" if notification else "Ответ службы поддержки",
        [row["body"]], action_url=action, action_label="Открыть администрирование" if action else "",
        note="Это сообщение отправлено из формы обратной связи Lektrus." if notification else "Если у вас остались вопросы, напишите нам через форму обратной связи."), subtype="html")
    return msg


async def send_feedback_email(row):
    host, port, username, password, sender, origin = server_mail_config()
    message = build_feedback_email(row, sender, origin)
    def send():
        context = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=10, context=context) as smtp:
                smtp.login(username, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=10) as smtp:
                smtp.ehlo()
                smtp.starttls(context=context)
                smtp.ehlo()
                smtp.login(username, password)
                smtp.send_message(message)
    await asyncio.wait_for(asyncio.to_thread(send), timeout=20)


async def deliver_one(pool) -> bool:
    # Claim in a single statement, release the DB connection before SMTP.
    async with pool.acquire() as conn:
        await conn.execute("""UPDATE feedback_mail SET status='failed',last_error='Не удалось подтвердить доставку.'
            WHERE status='sending' AND send_after<=now() AND attempts >= $1""", MAX_ATTEMPTS)
        row = await conn.fetchrow("""UPDATE feedback_mail SET status='sending', attempts=attempts+1,
            send_after=now()+interval '2 minutes' WHERE id=(
              SELECT id FROM feedback_mail WHERE status IN ('pending','sending') AND send_after<=now() AND attempts<$1
              ORDER BY send_after,created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
            RETURNING *""", MAX_ATTEMPTS)
    if row is None:
        return False
    row = dict(row)
    try:
        if row["kind"] == "notification":
            row["recipient"] = notification_recipient()
            if not row["recipient"]:
                # Only a single confirmed administrator is an unambiguous fallback.
                async with pool.acquire() as conn:
                    admins = await conn.fetch("SELECT email FROM account_users WHERE is_admin AND email_confirmed_at IS NOT NULL AND guest_board_id IS NULL LIMIT 2")
                if len(admins) != 1:
                    raise ValueError("feedback recipient not configured")
                row["recipient"] = feedback_email_address(admins[0]["email"])
        await send_feedback_email(row)
    except Exception as exc:
        # No raw SMTP errors, addresses, message bodies or secrets in logs.
        log.warning("Feedback mail delivery failed (%s)", type(exc).__name__)
        async with pool.acquire() as conn:
            await conn.execute("""UPDATE feedback_mail SET status=CASE WHEN attempts >= $2 THEN 'failed' ELSE 'pending' END,
                last_error='Не удалось отправить письмо. Проверьте настройки почты.',
                send_after=now()+CASE WHEN attempts=1 THEN interval '1 minute' ELSE interval '5 minutes' END
                WHERE id=$1 AND status='sending' AND attempts=$3""", row["id"], MAX_ATTEMPTS, row["attempts"])
    else:
        async with pool.acquire() as conn:
            await conn.execute("""UPDATE feedback_mail SET status='sent',recipient=$2,sent_at=now(),last_error=NULL
                WHERE id=$1 AND status='sending' AND attempts=$3""", row["id"], row["recipient"], row["attempts"])
    return True


async def run_feedback_mail(pool, wakeup: asyncio.Event):
    while True:
        wakeup.clear()
        try:
            if await deliver_one(pool):
                await asyncio.sleep(0.25)
                continue
        except Exception as exc:
            log.warning("Feedback mail queue unavailable (%s)", type(exc).__name__)
        try:
            await asyncio.wait_for(wakeup.wait(), timeout=30)
        except TimeoutError:
            pass
