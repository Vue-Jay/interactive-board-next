CREATE TABLE IF NOT EXISTS site_news (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL CHECK (category IN ('update', 'feature', 'announcement')),
    title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
    summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 500),
    body text NOT NULL DEFAULT '' CHECK (length(body) <= 12000),
    version text NOT NULL DEFAULT '' CHECK (length(version) <= 40),
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (published_at IS NULL OR (length(btrim(summary)) > 0 AND length(btrim(body)) > 0))
);
CREATE INDEX IF NOT EXISTS site_news_public_idx ON site_news (published_at DESC, id DESC) WHERE published_at IS NOT NULL;

-- Initial editorial entries describe releases already implemented in Lektrus.
INSERT INTO site_news (id, category, title, summary, body, published_at)
VALUES
('8aa00000-0000-4000-8000-000000000001', 'update', 'Lektrus на Android',
 'Официальное мобильное приложение можно установить прямо с сайта.',
 E'Работайте с досками, заданиями и учебными материалами на телефоне и планшете. В мобильной версии улучшена компоновка панелей доски, навигация и переключение рабочих пространств.\n\nУстановочный файл доступен в разделе «Скачать приложение».', now()),
('8aa00000-0000-4000-8000-000000000002', 'feature', 'Преподавание и обучение в одном аккаунте',
 'Переключайте рабочие пространства и приглашайте участников с подходящими правами.',
 'В Lektrus можно работать в двух режимах: «Я преподаю» и «Я учусь». Роль на конкретной доске зависит от приглашения и прав участника. Преподаватель может организовать совместную работу с учениками и сопреподавателями.', now() - interval '1 second')
ON CONFLICT (id) DO NOTHING;
