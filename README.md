# Lektrus

**Lektrus** — интерактивная учебная доска для преподавателей и учеников.
Одна кодовая база React 19 + TypeScript + Vite поддерживает совместное
редактирование, предметные инструменты и авторизацию через Supabase.

## Начало работы

Требуется Node.js 24+.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

В `.env.local` указываются `VITE_SUPABASE_URL` и
`VITE_SUPABASE_ANON_KEY` вашего проекта. **Не используйте service_role.**
Сайт в режиме разработки доступен по `http://localhost:5173`; для тестирования
на телефоне в одной сети используйте локальный IP компьютера.

```bash
npm run build
npm run test:ui
npm run native:check
```

## Android и iPhone

Проекты `android/` и `ios/` собираются из той же кодовой базы через Capacitor.
Рабочий Android debug APK публикуется как артефакт в
[GitHub Actions](https://github.com/Vue-Jay/interactive-board-next/actions/workflows/native-build.yml).
Для iPhone обычная сборка проверяется на симуляторе, а установка на физическое
устройство требует Apple code signing.

Команды:

```bash
npm run native:android
npm run native:ios
```

Детали настройки, загрузки APK и Apple Developer: [docs/NATIVE_APPS.md](docs/NATIVE_APPS.md).
PWA и HTTPS: [docs/CROSS_PLATFORM.md](docs/CROSS_PLATFORM.md).

## Хранение данных и безопасность

- Для нового Supabase проекта используйте проверенные миграции в `supabase/`.
  **Не запускайте повторно старые миграции на рабочей базе без резервной копии.**
- Доски и Realtime требуют интернет-соединения. Установка приложения не
  делает серверное сохранение автономным.
- Токены приглашений и доступ к данным защищаются политиками Supabase RLS.
- `.env.local`, закрытые ключи и резервные копии исключены из Git.

## Структура

- `src/`: интерфейс доски, редакторы, синхронизация, экраны приложения.
- `public/`: публичные изображения и PWA-манифест.
- `android/`, `ios/`: нативные проекты Capacitor.
- `supabase/`: SQL и миграции.
- `scripts/`, `tests/`: автоматические проверки.
- `docs/`: актуальные инструкции по сборке и инфраструктуре.

В репозитории удалены устаревшие текстовые отчёты `README_v*.txt`,
разовые скрипты `install_v*.mjs` и конфигурации старых хостингов.
История их изменений остаётся доступна через Git.
