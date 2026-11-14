FROM python:3.12.10-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/lektrus
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 lektrus \
    && mkdir -p /srv/lektrus-assets \
    && chown lektrus:lektrus /srv/lektrus-assets
COPY --chown=lektrus:lektrus app.py assets.py invitations.py ./
USER lektrus
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
