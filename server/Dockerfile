FROM python:3.12.10-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/lektrus
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 lektrus \
    && mkdir -p /srv/lektrus-assets \
    && chown lektrus:lektrus /srv/lektrus-assets
COPY --chown=lektrus:lektrus app.py document_delta.py assets.py invitations.py registration.py realtime_events.py education.py admin.py site_news.py comments.py materials.py notifications.py organization.py direct_chats.py share_links.py profiles.py schema.py pilot_operations.py pilot_objects.py board_history.py board_visits.py feedback_mail.py mail_templates.py board_templates.py android_updates.py maintenance.py ./
COPY --chown=lektrus:lektrus sql ./sql
USER lektrus
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
