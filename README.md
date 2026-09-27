# Telegram Course Platform v2 — `@Kurs91bot / tzmin`

Це оновлена версія вашого існуючого проєкту з `Курси.zip`. Вона **не замінює логіку «Технології змін»**, а розширює її до універсальної платформи курсів з власною адмінкою.

Поточні Telegram-дані вже зафіксовані в конфігурації/міграції:

- Bot Username: `@Kurs91bot`
- Mini App Short Name: `tzmin`
- Direct Link: `https://t.me/Kurs91bot/tzmin`
- Owner: Telegram ID `653398188`
- Test/Admin: `7527010484`
- Test/Admin: `8557032404`

> **Секрети не зашиті в репозиторій.** Bot Token, Supabase service role, S3/R2/Bunny/Cloudflare secrets вносяться тільки через Vercel Environment Variables.

---

## Що реалізовано у v2

### 1. Адмінка власника `/admin`

Адмінка відкривається тільки Telegram-акаунтам з таблиці `admin_users`. Перші три ID вже додаються міграцією `002_platform_admin.sql`.

Є розділи:

- **Огляд** — користувачі, курси, активні/завершені проходження, підписки, Stars.
- **Курси** — створення курсу, ціна, безкоштовність, All Access, правила проходження, публікація.
- **Редактор курсу** — UK/RU локалізації, кроки, розміщення курсу у різних Просторах.
- **Редактор кроку** — оригінальний текст + мультимедійні блоки.
- **Простори** — різні Telegram-вітрини для різних каналів.
- **Медіатека** — відео, аудіо, PDF, зображення, файли.
- **Провайдери** — YouTube/Vimeo/Cloudflare/Bunny/S3/Supabase/direct/HLS/DASH + додавання нових generic/S3-compatible провайдерів.
- **Імпорт** — завантаження цілого Course Package ZIP.
- **Користувачі** — Telegram ID, прогрес, підписки, покупки.
- **Платежі** — історія Telegram Stars.
- **Налаштування** — підтримка, донати, ціна All Access.
- **Адміни** — керування ролями (Owner може додавати/змінювати).

Ролі: `owner`, `admin`, `editor`, `support`, `analyst`.

### 2. Один рушій — багато Telegram-каналів / вітрин

Додана сутність **Space / Простір**. Один курс існує один раз, але може бути показаний:

- у Просторі корисного контенту;
- тільки у каналі про Трансерфінг;
- у фінансовому просторі;
- у тестовій вітрині;
- одночасно у кількох просторах.

Для кожного Space задаються:

- власна назва/опис/логотип;
- UK/RU тексти;
- тема;
- список доступних курсів;
- порядок курсів;
- override ціни конкретного курсу;
- безкоштовний/платний override;
- мовна політика.

Direct Link для простору:

```text
https://t.me/Kurs91bot/tzmin?startapp=space-SPACE_SLUG
```

Наприклад після створення `transurfing`:

```text
https://t.me/Kurs91bot/tzmin?startapp=space-transurfing
```

Користувач з такого каналу бачить **тільки курси, увімкнені у цьому Space**.

### 3. Українська + російська

Платформа має локалізацію інтерфейсу `uk` / `ru`.

Окремо локалізуються:

- Space;
- назва та вступ курсу;
- кожний крок;
- за потреби окремі мультимедійні блоки.

Якщо переклад відсутній, Space може працювати у режимі:

- `fallback` — показати базову версію;
- `hide_missing` — не показувати курс цією мовою.

Існуючий авторський курс автоматично мігрується в **UK** без переписування тексту. Російську версію ви додаєте через адмінку, коли вона готова.

### 4. Відео / аудіо / PDF прямо в Mini App

Крок може містити блоки:

- text
- video
- audio
- pdf
- image
- file
- link
- quote
- checklist
- divider

Відео/аудіо/PDF показуються всередині Mini App. Для PDF використовується PDF.js canvas-viewer, тобто користувачу не потрібно виходити з Telegram у Drive/браузер.

Для відео підтримані:

- звичайний MP4/HTTPS;
- HLS;
- MPEG-DASH;
- YouTube embed;
- Vimeo embed;
- Cloudflare Stream embed;
- Bunny Stream embed;
- приватний Supabase Storage;
- S3-compatible private storage через short-lived signed URL.

### 5. Медіапровайдери не прив'язані до одного хостингу

У таблиці `media_providers` є адаптери. Перший реліз містить:

- Supabase Storage
- YouTube
- Vimeo
- Cloudflare Stream
- Bunny Stream
- S3 compatible (AWS S3 / Cloudflare R2 / Backblaze B2 / Wasabi / DigitalOcean Spaces та інші S3-сумісні)
- Direct HTTPS
- iframe
- HLS
- DASH

Новий generic/direct/iframe/S3-compatible провайдер можна додати з адмінки без зміни структури курсів.

Секрети **ніколи не зберігаються в БД**. У БД зберігається лише `secret_env_prefix`, наприклад `MEDIA_S3_MAIN`, а Vercel містить:

```env
MEDIA_S3_MAIN_ENDPOINT=...
MEDIA_S3_MAIN_REGION=auto
MEDIA_S3_MAIN_BUCKET=...
MEDIA_S3_MAIN_ACCESS_KEY_ID=...
MEDIA_S3_MAIN_SECRET_ACCESS_KEY=...
```

Це дозволяє пізніше підключити власний домен/медіашлюз без перебудови контенту.

### 6. Захист контенту

Реалізовано практичний багаторівневий захист:

- сервер перевіряє право доступу перед видачею media token;
- media token короткоживучий і підписаний `MEDIA_SIGNING_SECRET`;
- приватний Supabase/S3 контент віддається через short-lived signed URL;
- UI не показує URL bucket/файлу;
- `controlsList="nodownload"`;
- захищена зона блокує звичайне context menu;
- text protection може відключати selection;
- PDF рендериться canvas-ом без стандартної кнопки Download/Print;
- відео/PDF/медіа підтримують **динамічний watermark** з Telegram username/ID/часом сесії.

#### Важливе технічне обмеження

У Telegram Mini App (WebView) **неможливо дати чесну 100% гарантію**, що користувач не зробить screenshot або screen recording на всіх Android/iOS/Desktop-пристроях. Також неможливо технічно приховати зовнішній домен YouTube/Vimeo від людини з developer tools.

Тому система робить те, що реально працює для Web-контенту: приватна доставка + короткоживучі токени + відсутність download UI + персональний рухомий watermark. Якщо потрібен справжній DRM-рівень для дорогого відео, підключається спеціалізований Stream/DRM-провайдер через Media Provider adapter.

### 7. Шеринг без видачі самого матеріалу

У курсі та кроці є `Поділитися`.

Створюється Telegram deep link на Mini App. Передається посилання на **курс/етап**, а не прямий PDF/MP4 або повний захищений контент.

Події зберігаються у `share_events`, тому надалі можна розвинути referral/affiliate аналітику.

### 8. Course Package — завантаження цілого готового курсу

Вам не потрібно руками створювати 30/91/150 кроків.

Сценарій:

1. Ви даєте сирий матеріал курсу.
2. Він готується/структурується у **Course Package**.
3. Ви отримуєте один `.zip`.
4. Адмінка → **Імпорт** → вибрати ZIP.
5. Платформа перевіряє manifest, кроки, локалізації та медіа.
6. Курс імпортується як **чернетка**.
7. Ви переглядаєте і тільки потім публікуєте.

Специфікація:

```text
course-package/COURSE_PACKAGE_SPEC.md
```

Готовий тестовий пакет:

```text
course-package/sample-course-package.zip
```

> Для великих відео Course Package повинен містити ID/URL медіапровайдера, а не багатогігабайтне відео всередині ZIP. Це обходить serverless upload limits Vercel та дозволяє використовувати безліч сховищ.

### 9. Гнучкі ціни

Базова ціна редагується **для кожного курсу окремо**.

Додатково у Space можна задати `price_override_stars`. Один і той самий курс може коштувати різну кількість Stars у різних вітринах.

Підписка All Access теж редагується через **Адмінка → Налаштування**, початково:

- 49 ⭐ / 30 днів;
- окремий платний курс — базово 99 ⭐, але кожен курс має власне поле ціни.

`Технологія змін` залишається безкоштовною + добровільний донат.

### 10. Логіка «Технології змін» збережена

- Крок 1 доступний **одразу** після натискання «Розпочати».
- Після виконання наступний крок відкривається тільки наступного навчального дня.
- Пропущений день не перескакує кроки.
- Після 5+ днів паузи пропонується нова спроба.
- Стара спроба архівується.
- Прогрес у Supabase.
- Клієнт не може перескочити серверну RPC-логіку.

Оригінальний файл та 91 структурований крок залишені у `content/`. Команда:

```bash
npm run verify:course
```

перевіряє їхню тотожність.

---

# ОНОВЛЕННЯ ВАШОГО ІСНУЮЧОГО ПРОЄКТУ

Це рекомендований сценарій для вас: **існуючі Supabase + Vercel зберігаються**, отже прогрес і користувачі не втрачаються.

## Крок 0. Резервна копія

Перед SQL-міграцією рекомендовано зробити backup Supabase або принаймні export критичних таблиць.

## Крок 1. Замініть код у GitHub

Завантажте вміст цього архіву у ваш поточний репозиторій (у вашому вихідному архіві remote був `savchinviktorm-create/Kurs`).

Не завантажуйте `.env.local` або секрети.

## Крок 2. Supabase → SQL Editor

Для існуючої бази **НЕ запускайте заново `001_initial.sql`**.

Запустіть лише:

```text
supabase/migrations/002_platform_admin.sql
```

Вона:

- не видаляє існуючих користувачів;
- не видаляє `course_attempts`;
- не видаляє платежі;
- створює CMS/Space/Media/Localization таблиці;
- створює приватний `course-media` bucket;
- додає Owner/Admin IDs;
- робить Крок 1 доступним одразу;
- розблоковує існуючі спроби, що ще стоять на невиконаному Кроці 1;
- додає `pkk` Space і прив'язує існуючі курси.

## Крок 3. Vercel Environment Variables

Збережіть усі старі змінні й додайте:

```env
TELEGRAM_BOT_USERNAME=Kurs91bot
TELEGRAM_MINIAPP_SHORT_NAME=tzmin
MEDIA_SIGNING_SECRET=ДУЖЕ_ДОВГИЙ_ВИПАДКОВИЙ_СЕКРЕТ
MEDIA_TOKEN_TTL_SECONDS=300
COURSE_IMPORT_MAX_BYTES=4000000
```

Ваш старий `NEXT_PUBLIC_APP_URL` залиште без змін. Якщо він вже є у Vercel — нічого переносити не потрібно.

Створити `MEDIA_SIGNING_SECRET` локально можна, наприклад:

```bash
openssl rand -hex 32
```

## Крок 4. Redeploy

Після commit GitHub Vercel зробить deploy. Якщо автоматичний deploy вимкнений — натисніть **Redeploy**.

## Крок 5. Перевірка

Відкрийте:

```text
https://t.me/Kurs91bot/tzmin
```

Для ID `653398188`, `7527010484`, `8557032404` на головній сторінці має з'явитися кнопка **Адмінка**.

Перевірте:

1. `Технологія змін` відкривається.
2. Крок 1 одразу доступний для нового старту.
3. Платний блок не показується, поки у Space немає платного курсу.
4. `/admin` відкривається лише трьом дозволеним ID.
5. Створіть тестовий Space і перевірте його direct link.
6. Імпортуйте `course-package/sample-course-package.zip` — він повинен з'явитися як чернетка.

---

# ЧИСТА УСТАНОВКА НА НОВИЙ SUPABASE / VERCEL

Для нового окремого проєкту:

1. Новий Supabase.
2. SQL Editor → запустити:

```text
supabase/FRESH_INSTALL.sql
```

3. Додати env із `.env.example`.
4. `npm install`.
5. `npm run verify:course`.
6. `npm run seed`.
7. Deploy на Vercel.
8. Локально з production env: `npm run setup:telegram`.

`setup:telegram` налаштовує webhook/menu/commands для бота. Short Name `tzmin` уже існує в BotFather і скрипт його не перевизначає.

---

# Налаштування конкретних медіапровайдерів

## Supabase Storage

Провайдер `supabase` вже існує. Малий PDF/аудіо/зображення можна завантажити з Адмінки → Медіатека.

## YouTube

Provider: `youtube`  
`source_locator`: video ID або YouTube URL.

## Vimeo

Provider: `vimeo`  
`source_locator`: video ID або Vimeo URL.

## Cloudflare Stream

Provider: `cloudflare-stream`. У Admin → Providers встановіть config, наприклад:

```json
{
  "customer_subdomain": "https://customer-XXXXXXXX.cloudflarestream.com"
}
```

`source_locator` = Stream video UID.

## Bunny Stream

Provider: `bunny-stream`. У config:

```json
{
  "library_id": "123456"
}
```

`source_locator` = video ID.

## S3 / R2 / B2 / Wasabi / DigitalOcean Spaces

Створіть окремий provider із `delivery_type = s3`, наприклад:

```text
provider_key: r2-main
secret_env_prefix: MEDIA_R2_MAIN
```

Vercel:

```env
MEDIA_R2_MAIN_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
MEDIA_R2_MAIN_REGION=auto
MEDIA_R2_MAIN_BUCKET=my-private-bucket
MEDIA_R2_MAIN_ACCESS_KEY_ID=...
MEDIA_R2_MAIN_SECRET_ACCESS_KEY=...
```

У `source_locator` зберігається тільки object key. Користувач отримує тимчасовий signed URL після перевірки доступу.

---

# Власний домен у майбутньому

Нинішній Vercel URL можна залишити.

Коли з'явиться домен, рекомендована схема:

```text
app.example.com    -> Vercel Mini App
media.example.com  -> media proxy/CDN/Stream
```

База курсів при цьому не перебудовується: media assets посилаються на абстрактний Provider, тому джерело можна мігрувати поступово.

---

# Office-документи

Inline viewer працює з PDF. Для DOCX/PPTX/XLSX:

- зберігайте оригінал як admin-source;
- для користувача додавайте PDF-копію;
- якщо пізніше буде зовнішній сервіс конвертації, у `.env.example` вже залишені `DOCUMENT_CONVERTER_URL` / `DOCUMENT_CONVERTER_TOKEN` як точка розширення.

Немає сенсу вбудовувати LibreOffice у Vercel serverless.

---

# Безпека

- Telegram `initData` перевіряється сервером HMAC.
- Адмінка перевіряє Telegram numeric ID у БД.
- Service Role ніколи не доступний браузеру.
- RLS увімкнений.
- state-changing RPC доступні лише service role.
- Telegram webhook перевіряє secret header.
- media token підписаний окремим secret.
- Provider secrets тільки у Vercel env.
- Course Package імпортується тільки адміністратором.
- Курс після імпорту не публікується автоматично.

---

# Основні файли v2

```text
app/admin/                       CMS
app/api/admin/                   admin API
app/api/media/                   захищена доставка media
app/api/share/                   deep-link sharing
lib/admin.js                     ролі/авторизація CMS
lib/platform.js                  Space + language routing
lib/media.js                     provider adapters
lib/media-token.js               short-lived media token
components/ProtectedMedia.js     video/audio/PDF viewer + watermark
components/StepBlocks.js         мультимедійні блоки кроку
supabase/migrations/002_platform_admin.sql
supabase/FRESH_INSTALL.sql
course-package/COURSE_PACKAGE_SPEC.md
course-package/sample-course-package.zip
```

---

## Перевірка авторського курсу

У цій збірці `npm run verify:course` повертає:

```text
OK: 91 steps; structured text exactly matches the original course file.
```

Тобто функціональна перебудова платформи не змінює текст існуючого авторського курсу.


## Додаткові інструкції

- `INSTALLATION_GUIDE_UA.md` — детальна інструкція оновлення чинного Vercel/Supabase та чистої інсталяції.
- `DEPLOY_CHECKLIST.md` — короткий checklist.
- `VALIDATION_REPORT.md` — що було перевірено перед упаковкою.

## Додано у фінальній збірці

- Завантаження логотипів/обкладинок курсу та Space прямо з адмінки у `course-public`.
- Для майбутніх курсів параметр `max_steps_per_day`; «Технологія змін» залишається `1`.
- Опціональний Office→PDF adapter через `DOCUMENT_CONVERTER_URL`: DOC/DOCX/PPT/PPTX/XLS/XLSX/ODT/ODS/ODP можна завантажити як оригінал, а при підключеному converter сервісі користувачу автоматично видається приватна PDF-копія для inline viewer.
- Детальна production-інструкція: `INSTALLATION_GUIDE_UA.md`.

### Контракт Office → PDF converter

Платформа робить `POST multipart/form-data` на `DOCUMENT_CONVERTER_URL`:

- поле `file` — оригінальний документ;
- поле `output=pdf`;
- якщо задано `DOCUMENT_CONVERTER_TOKEN`, додається `Authorization: Bearer ...`.

Converter може повернути або `application/pdf` напряму, або JSON `{ "url": "https://.../converted.pdf" }`. Отримана PDF-копія переноситься у приватний Supabase Storage; оригінал зберігається окремо в metadata.
