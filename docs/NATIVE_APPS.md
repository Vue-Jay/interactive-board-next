# Lektrus: настоящие приложения Android и iOS

Lektrus использует **Capacitor 8.5.3** для сборки отдельно устанавливаемых приложений из одной кодовой базы React/TypeScript. В отличие от PWA, Android APK и iOS App содержат собственный WebView и встроенные ресурсы `dist`. Supabase продолжает обслуживать сетевую авторизацию, файлы и совместные доски.

## Android: APK

Автоматическая сборка идёт в [GitHub Actions](https://github.com/Vue-Jay/interactive-board-next/actions/workflows/native-build.yml) после успешного включения изменений в `main`. Откройте самый свежий запуск, найдите артефакт **Lektrus-Android-debug-APK**, скачайте ZIP и извлеките `app-debug.apk`. Это реально устанавливаемый **debug APK** с тестовой подписью, но не подписанный производственный релиз. Для установки Android может попросить разрешить установку из выбранного источника.

Локально на Windows:

1. Установите Node.js 24+, Android Studio с Android SDK и JDK 21.
2. `npm ci`
3. Скопируйте `.env.example` в `.env.local`, заполните **публичные** `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` из текущего проекта (не service_role).
4. `npm run native:android`. После этого в Android Studio выберите Build APK либо соберите командой `cd android && gradlew.bat assembleDebug`.
5. APK окажется в `android/app/build/outputs/apk/debug/`. Для установки по USB используйте `adb install -r app-debug.apk`.

Для рабочей онлайн-сборки через Actions добавьте GitHub Actions Secrets `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` **именно нового проекта Supabase**. Если Secrets не указаны, при первом запуске APK откроется экран **«Подключить Lektrus»**. Введите `VITE_SUPABASE_URL` и публичный ключ `VITE_SUPABASE_ANON_KEY` из своей `.env.local`. Подключение сохранится на устройстве, после чего вход и синхронизация будут работать с выбранным проектом Supabase. Чтобы изменить сервер, откройте **Настройки → Сервер Lektrus → Изменить**. Для APK, уже собранных со встроенными GitHub Secrets, ручной ввод не требуется.

## iPhone и iPad: Xcode, TestFlight, IPA

iOS собирается на macOS 26/Xcode 26 через GitHub Actions. Артефакт **Lektrus-iOS-simulator-app** содержит проверочную сборку только для симулятора. Она **не устанавливается на обычный iPhone**.

Чтобы получить установленное приложение для физического устройства:

1. Нужны Mac с Xcode 26+, Apple ID и для распространения через TestFlight/App Store действующее членство в Apple Developer Program.
2. `npm ci`, заполнить `.env.local`, затем `npm run native:ios`.
3. В Xcode выберите `ios/App/App.xcodeproj`, настройте Signing & Capabilities, Team, Bundle Identifier `ru.lektrus.board` (если идентификатор свободен), устройство.
4. Соберите и установите на своё устройство через Xcode. Для TestFlight/IPA используйте Product → Archive → Distribute App, выберите требуемый профиль подписи. Доступ в TestFlight зависит от учётной записи Apple и процедур Apple.
5. Подписанный IPA невозможно сделать из GitHub без сертификата распространения, provisioning profile и учётной записи разработчика. Не загружайте закрытые ключи или сертификаты в открытый репозиторий.

## Верификация электронной почты

В нативном приложении внутренние адреса `capacitor://localhost` и `https://localhost` не используются для ссылок подтверждения Supabase. Вместо этого при настройке можно указать **публичную HTTPS** страницу подтверждения через `VITE_AUTH_REDIRECT_URL` в сборке или переменную GitHub Actions `LEKTRUS_AUTH_REDIRECT_URL`. Без этого Supabase использует настроенный **Site URL**, а пользователь после подтверждения почты возвращается в приложение и входит снова.

Не нужно менять действующий Site URL Supabase на `capacitor://localhost`. Уже работающие веб-приглашения `/join/:token` продолжат работать через браузер; для их автоматического открытия непосредственно в приложении потребуется будущий постоянный домен и Universal Links/App Links.

## Примечания

- Интерфейс и редакторы входят в APK/iOS App; совместное редактирование и сохранение на сервере **требуют интернет**.
- Нативная сборка сама не развертывает сайт, не меняет Supabase SQL и не включает старые Vercel/Tuqo workflow.
- Для публикации в магазинах нужны производственные иконки/скриншоты, подпись, политика конфиденциальности и тестирование на реальных устройствах.

## Подписанная iOS-сборка в GitHub Actions

Есть отдельный ручной workflow [Lektrus signed iPhone IPA](https://github.com/Vue-Jay/interactive-board-next/actions/workflows/native-ios-signed.yml). Он **не запускается автоматически**, так как требует приватные сертификаты Apple. После добавления защищённых GitHub Actions Secrets `APPLE_TEAM_ID`, `IOS_PROFILE_NAME`, `IOS_CERTIFICATE_P12_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64` (и двух публичных параметров Supabase) запустите workflow вручную. Он создаст archive и попытается экспортировать IPA для App Store Connect. Используйте provisioning profile типа App Store Distribution, соответствующий `ru.lektrus.board`. Для установки через TestFlight загрузите IPA в App Store Connect и завершите требуемую Apple обработку/проверки. Сам файл IPA не обходит подпись Apple.

## Брендинг приложений

Единственным исходником иконки является `assets/lektrus-brand-source.png`, созданный из переданного изображения. По нему в workflow `refresh-brand-icons.yml` генерируются размеры 192/512/1024 px и системные ресурсы Android и iOS. Старые файлы с альтернативными вариантами логотипа и PWA-иконкой удалены, а экран входа, шапка, favicon и ярлыки используют единый логотип.

## Обновления Android без удаления приложения

Android обновляет установленный `ru.lektrus.board` только тогда, когда
`versionCode` новой версии **выше** и сертификат подписи совпадает с
сертификатом установленной версии. Старые тестовые APK создавались на
разных временных GitHub runner без общего debug keystore, поэтому обновление
старой тестовой установки может быть невозможно. Удаление такого APK
удаляет локальное хранилище приложения: предварительно проверьте, что
важные доски уже синхронизированы с Supabase.

Для постоянных обновляемых выпусков однажды создайте и сохраните офлайн
**личный release keystore**. Настройте в GitHub Actions secrets:

- `LEKTRUS_SIGNING_STORE_BASE64`: base64 всего файла `.jks`.
- `LEKTRUS_SIGNING_STORE_PASSWORD`: пароль хранилища.
- `LEKTRUS_SIGNING_KEY_ALIAS`: alias ключа.
- `LEKTRUS_SIGNING_KEY_PASSWORD`: пароль ключа.

Не добавляйте `.jks` и пароли в git, issues или чат. Потеря
ключа может потребовать удаления приложения при обновлении.
GitHub Actions будет собирать подписанный release APK, если указаны
все четыре секрета; иначе останется debug APK с предупреждением.
Имя артефакта: `Lektrus-Android-APK`.
`versionCode` и `versionName` теперь автоматически получают номер
запуска workflow. После первого перехода с прежней debug-подписи на
постоянную release-подпись потребуется однократная переустановка.

## Android сообщает о конфликте пакетов

Если установленный APK подписан другим временным debug-ключом GitHub,
обычный Android APK `ru.lektrus.board` не обновит существующую установку.
Это ограничение проверки цифровой подписи Android, его нельзя обойти
повышением номера версии или программным кодом.

Для проверки без удаления прежнего приложения CI теперь собирает
`Lektrus-Android-Fresh-Install` с ID `ru.lektrus.board.fresh`.
Он устанавливается **отдельно** и хранит собственные настройки и
локальные данные. Чтобы открыть ранее сохранённые серверные доски,
подключите новый экземпляр к тому же Supabase и войдите под своим
аккаунтом. Доски, существующие только локально в старом экземпляре, не
переносятся автоматически. Для выпуска постоянного обновляемого
приложения настройте стабильную release-подпись.
