# Детальна інструкція розгортання — Telegram Course Platform v2

Цей архів підготовлений як **оновлення чинного Mini App** та як **самостійна чиста інсталяція**.

Зафіксовані дані:

- Bot Username: `@Kurs91bot`
- Mini App Short Name: `tzmin`
- Direct Link: `https://t.me/Kurs91bot/tzmin`
- Owner Telegram ID: `653398188`
- Admin/Test ID: `7527010484`
- Admin/Test ID: `8557032404`
- базовий All Access: `49 ⭐ / 30 днів`
- базова ціна окремого платного курсу: `99 ⭐`, але ціна кожного курсу редагується в адмінці
- «Технологія змін» залишається безкоштовною, донат — добровільний

> У вихідному `Курси.zip` не було фактичної production Vercel URL — у `.env.example` була лише заглушка. Тому v2 **не вигадує і не зашиває іншу адресу**. При оновленні того самого Vercel-проєкту залиште наявну `NEXT_PUBLIC_APP_URL`; сервер також уміє використати `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` як runtime fallback.

---

## A. Рекомендований варіант: оновити ЧИННИЙ проєкт

Цей шлях зберігає поточних користувачів, прогрес, платежі та URL.

### 1. Зробіть резервну копію

Перед міграцією:

1. Supabase → Database → зробіть backup / snapshot доступним для вашого тарифу.
2. У GitHub створіть тег або окрему гілку поточного робочого стану, наприклад `before-platform-v2`.

### 2. Замініть код у поточному GitHub-репозиторії

Скопіюйте вміст цього архіву в корінь чинного репозиторію.

**Не переносіть `.env` із секретами в GitHub.** У репозиторії повинен залишитися тільки `.env.example`.

Після push Vercel, якщо він уже підключений до цього репозиторію, створить новий deployment автоматично.

### 3. Оновіть базу Supabase

У чинній базі **не запускайте `FRESH_INSTALL.sql`**.

Виконайте тільки:

```text
supabase/migrations/002_platform_admin.sql
```

Шлях:

1. Supabase → SQL Editor.
2. New query.
3. Відкрити файл `002_platform_admin.sql` з архіву.
4. Скопіювати весь SQL.
5. Run.

Міграція:

- не видаляє існуючі `users`;
- не видаляє `course_attempts`;
- не видаляє платежі/entitlements/subscriptions;
- додає адмінку, Spaces, локалізації, медіа, імпорт, версії та аудит;
- робить Крок 1 доступним одразу для нових спроб;
- розблоковує вже створені спроби, де ще не завершено Крок 1;
- додає ваш Owner/Admin ID.

### 4. Перевірте Environment Variables у Vercel

Vercel → Project → Settings → Environment Variables.

Залиште чинні значення:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://ВАША-ПОТОЧНА-АДРЕСА.vercel.app
```

Додайте/перевірте:

```env
TELEGRAM_BOT_USERNAME=Kurs91bot
TELEGRAM_MINIAPP_SHORT_NAME=tzmin
MEDIA_SIGNING_SECRET=ДУЖЕ_ДОВГИЙ_ВИПАДКОВИЙ_СЕКРЕТ
MEDIA_TOKEN_TTL_SECONDS=300
COURSE_IMPORT_MAX_BYTES=4000000
ALL_ACCESS_SUBSCRIPTION_STARS=49
DEFAULT_COURSE_PRICE_STARS=99
```

`MEDIA_SIGNING_SECRET` не копіюйте з документації. Згенеруйте власний випадковий секрет мінімум 32 bytes.

### 5. Redeploy

Після додавання environment variables:

1. Vercel → Deployments.
2. Виберіть останній deployment.
3. Redeploy, якщо environment variables додавалися після автоматичного build.

### 6. Telegram / BotFather

Short Name уже відомий:

```text
tzmin
```

Direct Link:

```text
https://t.me/Kurs91bot/tzmin
```

Якщо Web App URL у BotFather уже вказує на чинну Vercel production URL і вона не змінювалась — нічого міняти не треба.

Якщо URL змінився — оновіть Web App URL у BotFather.

Webhook можна повторно встановити командою `npm run setup:telegram`, якщо запускаєте скрипт у середовищі з production env.

---

## B. Чиста інсталяція в НОВОМУ Supabase/Vercel

### 1. Створіть новий Supabase project

Після створення відкрийте SQL Editor і виконайте:

```text
supabase/FRESH_INSTALL.sql
```

Цей файл містить початкову схему + platform v2.

### 2. Підготуйте env

Скопіюйте `.env.example` у локальний `.env.local` і заповніть секрети. `.env.local` не комітьте.

### 3. Встановіть залежності

```bash
npm install
```

### 4. Перевірте авторський курс

```bash
npm run verify:course
```

Очікуваний результат:

```text
OK: 91 steps; structured text exactly matches the original course file.
SHA-256: 824a5f466b19aa47452a9537a060d78c1ec419189bf0efd0c3b284bac3112867
```

### 5. Завантажте «Технологію змін» у нову БД

```bash
npm run seed
```

### 6. Deploy у Vercel

Підключіть GitHub repo до Vercel та додайте environment variables з `.env.example`.

Після production deploy вкажіть production URL у `NEXT_PUBLIC_APP_URL` і зробіть redeploy.

### 7. Налаштуйте Telegram

У середовищі з production env:

```bash
npm run setup:telegram
```

Потім перевірте:

```text
https://t.me/Kurs91bot/tzmin
```

---

# Перший вхід в адмінку

Адмінка: `/admin` усередині того самого Mini App.

Початкові ролі після міграції:

- `653398188` → `owner`
- `7527010484` → `admin`
- `8557032404` → `admin`

Owner може додавати нових адміністраторів і змінювати ролі.

Ролі:

- `owner` — усе;
- `admin` — повне операційне керування;
- `editor` — контент/курси;
- `support` — користувачі/доступи;
- `analyst` — статистика.

---

# Як створити окрему вітрину для Telegram-каналу

Адмінка → **Простори** → **Новий простір**.

Наприклад:

```text
Назва: Трансерфінг реальності
Slug: transurfing
```

Після створення direct link:

```text
https://t.me/Kurs91bot/tzmin?startapp=space-transurfing
```

У редакторі Space відмітьте тільки ті курси, які мають бути видимі у цьому Telegram-каналі.

Один курс можна увімкнути одночасно у кількох Spaces. Копії курсу не створюються.

---

# Українська / російська версії

У Course Editor є локалізації `uk` та `ru`.

У Space задаються:

- `default_locale`;
- `allowed_locales`;
- `locale_policy`.

`fallback` — якщо RU ще не готова, показати базову версію.

`hide_missing` — приховати курс для цієї мови, доки переклад не готовий.

Якщо структура курсу однакова, прогрес належить одному курсу і при перемиканні мови не обнуляється.

---

# Медіа: як використовувати різні сховища

Адмінка → **Провайдери**.

Перший реліз має адаптери для:

- Supabase Storage;
- YouTube;
- Vimeo;
- Cloudflare Stream;
- Bunny Stream;
- S3-compatible storage (AWS S3, R2, B2, Wasabi, DigitalOcean Spaces тощо);
- Direct HTTPS;
- iframe;
- HLS;
- MPEG-DASH.

## Supabase Storage

Невеликі PDF/audio/image можна завантажувати через **Медіатека → Завантажити**.

Файли йдуть у приватний bucket `course-media`.

## YouTube / Vimeo

У Медіатеці створіть asset:

- provider: YouTube/Vimeo;
- type: video;
- source locator: URL або ID відео.

Користувач бачить вбудований player у Mini App.

## S3 / R2 / B2 / Wasabi / DigitalOcean Spaces

Створіть/відредагуйте provider з `delivery_type=s3` і `secret_env_prefix`, наприклад:

```text
MEDIA_S3_ARCHIVE
```

У Vercel:

```env
MEDIA_S3_ARCHIVE_ENDPOINT=...
MEDIA_S3_ARCHIVE_REGION=auto
MEDIA_S3_ARCHIVE_BUCKET=...
MEDIA_S3_ARCHIVE_ACCESS_KEY_ID=...
MEDIA_S3_ARCHIVE_SECRET_ACCESS_KEY=...
```

У БД секретів немає.

## Власний media domain у майбутньому

Архітектура не прив’язує крок до фізичного домену. Крок посилається на `media_asset`, а asset — на provider. Тому пізніше можна підключити `media.example.com`, CDN або інший storage без зміни структури самого курсу.

---

# Захист контенту

Рівні:

- `standard`
- `enhanced`
- `maximum`

Реалізовано:

- серверну перевірку права доступу;
- короткоживучий media token;
- signed URLs для private Supabase/S3;
- `nodownload` у вбудованих player controls;
- PDF.js canvas-viewer без стандартної кнопки Download/Print;
- блокування простого context menu;
- опціональний захист виділення тексту;
- персональний рухомий watermark.

Важливо: HTML5/Telegram WebView не може гарантувати 100% заборону screenshot/screen recording на всіх пристроях. Watermark використовується як практичний захист від анонімного витоку.

---

# Додавання відео, аудіо, PDF у крок

1. Адмінка → Медіатека.
2. Додайте asset або завантажте файл.
3. Адмінка → Курси → потрібний курс → потрібний крок.
4. Натисніть `+ Блок`.
5. Виберіть `video`, `audio`, `pdf`, `image` або `file`.
6. Виберіть media asset.
7. Збережіть.

Блоки можна переставляти.

---

# Імпорт ЦІЛОГО курсу одним ZIP

У корені проєкту:

```text
course-package/COURSE_PACKAGE_SPEC.md
course-package/sample-course-package.zip
```

Сценарій:

1. Підготувати Course Package ZIP.
2. Адмінка → Імпорт.
3. Вибрати ZIP.
4. Імпорт.
5. Курс створиться як чернетка.
6. Перевірити кроки/локалізації/медіа.
7. Додати його до потрібних Spaces.
8. Опублікувати.

Великі відео не рекомендується вкладати у ZIP: у manifest передавайте provider + URL/ID.

---

# Ціни

У кожного курсу є власна `one_time_price_stars`.

У кожному Space можливий `price_override_stars`.

Тому один курс може мати, наприклад:

- 99 ⭐ у головному Просторі;
- 79 ⭐ у промо-просторі.

All Access редагується окремо в **Налаштування → Підписки**. Початково — 49 ⭐ / 30 днів.

Блок All Access не показується користувачу, якщо у поточному Space немає жодного платного курсу.

---

# Підтримка

Початково вимкнена.

Адмінка → Налаштування → Підтримка:

- Telegram bot;
- Telegram username;
- URL;
- Email.

Коли створите окремого support-бота, просто внесіть його — персональні контакти власника показувати не потрібно.

---

# Шеринг

Кнопка «Поділитися» створює deep link у Mini App, а не посилання на захищений файл.

Події записуються в `share_events`, а в адмінці є вкладка **Шеринг**.

Це дозволяє бачити органічні рекомендації й у майбутньому розширити систему до referral/affiliate.

---

# Версії та безпечне редагування

Курс і кроки підтримують snapshots у `course_versions`.

В Course Editor можна відновити попередню версію.

Текст кроку в редакторі має локальне autosave у браузері, але в БД зміни йдуть тільки після натискання **Зберегти**.

Для великих структурних змін у курсі, який уже проходять люди, спочатку робіть snapshot/чернетку і тестуйте на тестових Admin ID.

---

# Що перевірити після deployment

1. `https://t.me/Kurs91bot/tzmin` відкривається.
2. Ім’я користувача приходить із Telegram.
3. «Технологія змін» безкоштовна.
4. Крок 1 відкривається одразу.
5. Після завершення Кроку 1 наступний заблокований до наступного навчального дня.
6. Попередній крок не можна відкрити зі звичайного клієнтського UI.
7. Після 5+ пропущених навчальних днів з’являється пропозиція перезапуску.
8. `/admin` доступний тільки трьом початковим Admin ID.
9. Створіть тестовий Space та відкрийте його через `startapp=space-...`.
10. Створіть тестовий media asset YouTube/PDF і прикріпіть до кроку.
11. Перевірте watermark.
12. Перевірте, що All Access не показується, якщо у Space немає платного курсу.
13. Створіть чернетку платного курсу, виставте ціну, опублікуйте, перевірте Stars invoice.
14. Перевірте `/terms` і `/paysupport` перед реальними продажами.

---

# Відкат

Якщо після deployment виникла критична помилка:

1. Vercel → Deployments → Promote/Rollback на попередній working deployment.
2. Код — повернути Git branch/tag `before-platform-v2`.
3. **Не видаляйте нові таблиці поспіхом.** Додаткові таблиці v2 не заважають старому deployment. Це дозволяє повернути UI назад без втрати нових даних.
4. Якщо потрібен повний DB rollback — використовуйте backup Supabase, зроблений перед міграцією.

