# ⚙️ Технологія змін — Telegram Mini App

Готовий проєкт Telegram Mini App для курсу **«Технологія змін: 91 крок до управління власним життям»**.

Проєкт зроблений так, щоб поточний курс був безкоштовним, а надалі в цей самий застосунок можна було додавати нові безкоштовні або платні курси.

## Що вже реалізовано

- Telegram розпізнає користувача через підписаний `initData`; прогрес прив'язаний до незмінного Telegram ID, а не до імені.
- Серверна перевірка `initData` через HMAC-SHA-256.
- Оригінальний курс збережений **без скорочень і без переписування**: 91 крок + вступ.
- Перший крок після старту відкривається **наступного дня об 11:00** за `Europe/Kyiv`, як у тексті курсу.
- Один користувач може завершити лише один поточний крок за навчальний день.
- Неможливо відкрити попередній або довільний наступний крок через інтерфейс чи API.
- Пропущені дні не перескакують кроки: після паузи відкривається лише наступний невиконаний крок.
- Після 5+ пропущених днів пропонується почати курс заново; стара спроба архівується, а не видаляється.
- Прогрес зберігається в Supabase, тому не зникає при зміні телефону чи повторному вході.
- Progress bar, номер дня, номер тижня та фінальний екран 91/91.
- Добровільні донати за поточний безкоштовний курс через Telegram Stars.
- Майбутні платні курси: постійний доступ за ціною курсу (типово 99 ⭐).
- Щомісячна підписка на всі платні курси — типово 49 ⭐ / 30 днів.
- Telegram webhook обробляє `pre_checkout_query`, `successful_payment` і `refunded_payment`.
- `/start`, `/terms`, `/paysupport` і кнопка Mini App у меню бота.
- Архітектура вже підтримує додавання інших курсів без переписування двигуна.

## Стек

- Next.js + React
- Telegram Mini Apps + Telegram Bot API
- Telegram Stars (`XTR`)
- Supabase/PostgreSQL
- Vercel для простого HTTPS-деплою

## Структура

```text
app/                         інтерфейс і API
  api/bootstrap/             профіль, каталог, підписка
  api/course/[slug]/         стан курсу
  api/course/[slug]/start/   старт
  api/course/[slug]/complete/завершення поточного кроку
  api/course/[slug]/restart/ нова спроба
  api/payments/invoice/      створення Telegram Stars invoice
  api/telegram/webhook/      платежі + команди бота
content/
  technology-changes-original.txt  оригінальний авторський файл
  technology-changes.json          структурована 1:1 копія для БД
public/
  technology-changes-logo.png      логотип курсу
supabase/migrations/
  001_initial.sql            таблиці + серверні RPC
scripts/
  verify-course.mjs          перевірка незмінності тексту
  seed-course.mjs            завантаження 91 кроку в Supabase
  setup-telegram.mjs         webhook + menu button + commands
```

---

# Запуск без програмістського досвіду

## 1. Створіть GitHub-репозиторій

1. Розпакуйте ZIP.
2. Створіть порожній репозиторій на GitHub.
3. Завантажте **вміст папки проєкту** у корінь репозиторію.

## 2. Створіть Telegram-бота

У `@BotFather` створіть бота та скопіюйте Bot Token.

Нічого секретного в GitHub не публікуйте.

## 3. Створіть Supabase

1. Створіть новий проєкт на Supabase.
2. Відкрийте **SQL Editor**.
3. Скопіюйте весь файл `supabase/migrations/001_initial.sql` і виконайте його.
4. У Settings → API знайдіть:
   - Project URL → `SUPABASE_URL`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`

**Service role key є секретним. Не вставляйте його в код або GitHub.**

## 4. Розгорніть на Vercel

1. Імпортуйте GitHub-репозиторій у Vercel.
2. У Project Settings → Environment Variables додайте:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=будь-який-довгий-випадковий-рядок
NEXT_PUBLIC_APP_URL=https://ваш-проєкт.vercel.app
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ALL_ACCESS_SUBSCRIPTION_STARS=49
DEFAULT_COURSE_PRICE_STARS=99
ENABLE_DEMO_AUTH=false
```

3. Зробіть Deploy.

## 5. Один раз завантажте курс у БД

На комп'ютері у папці проєкту:

```bash
npm install
```

Створіть `.env.local` на основі `.env.example` і вставте Supabase URL + Service Role Key.

Далі:

```bash
npm run verify:course
npm run seed
```

`verify:course` повинен вивести:

```text
OK: 91 steps; structured text exactly matches the original course file.
```

## 6. Підключіть Mini App до Telegram

У тому самому `.env.local` додайте Bot Token, webhook secret і вашу Vercel URL, після чого:

```bash
npm run setup:telegram
```

Скрипт автоматично:

- встановить webhook `https://ВАШ-ДОМЕН/api/telegram/webhook`;
- додасть кнопку **«Курси»** в меню бота;
- створить команди `/start`, `/terms`, `/paysupport`.

Після цього відкрийте бота в Telegram і натисніть **Start → Відкрити Mini App**.

---

# Логіка «1 крок = 1 день»

Після старту курс створює активну спробу. Перший крок стає доступним наступного дня об 11:00. Після завершення поточного кроку сервер ставить наступне відкриття на наступний день об 11:00.

Ключове: блокування виконується **в PostgreSQL RPC**, а не лише кнопками браузера. Тому підміна HTML/JavaScript не дає можливості перескочити вперед.

Якщо користувач пройшов 1-й та 2-й крок, потім два дні не заходив, наступним залишається 3-й крок. Пропущені календарні дні не збільшують номер кроку.

Після 5+ пропущених днів з'являється рекомендація почати спочатку. При підтвердженні поточна спроба отримує статус `archived`, а нова стартує з Кроку 1.

---

# Telegram Stars

Поточний курс має `is_free = true`, тому **ніколи не вимагає оплати**. Донат — тільки добровільний.

Для майбутніх курсів:

- `is_free = false`
- `one_time_price_stars = 99` (або інша ціна)
- постійний доступ видається лише після `successful_payment`
- all-access підписка — 49 ⭐ / 30 днів, `subscription_period = 2592000`

Платежі не вважаються успішними за фактом закриття вікна invoice. Сервер чекає Telegram webhook із `successful_payment` і зберігає `telegram_payment_charge_id`.

---

# Додавання нового курсу

Структура нового курсу вже підготовлена у `content/COURSE_TEMPLATE.json`.

Для кожного нового курсу потрібні:

- `slug`
- назва і коротка назва
- оригінальний вступ
- кількість кроків
- часовий пояс / година відкриття
- правило тривалої паузи
- безкоштовний чи платний статус
- ціна у Stars
- логотип
- масив кроків із повним текстом

Новий курс додається в таблиці `courses` і `course_steps`. Двигун прогресу, оплати та Telegram-авторизації змінювати не потрібно.

---

# Безпека

- `SUPABASE_SERVICE_ROLE_KEY` та `TELEGRAM_BOT_TOKEN` працюють тільки на сервері.
- Не використовуйте `NEXT_PUBLIC_` для секретів.
- Telegram `initDataUnsafe` не використовується для авторизації.
- Сервер перевіряє HMAC `initData` і термін його дії.
- Supabase RLS увімкнений; браузер напряму до БД не підключається.
- RPC зміни прогресу відкликані у `anon` та `authenticated` і доступні лише `service_role`.
- Webhook Telegram додатково перевіряє `X-Telegram-Bot-Api-Secret-Token`.

Офіційна документація Telegram:
- Mini Apps: https://core.telegram.org/bots/webapps
- Bot API: https://core.telegram.org/bots/api
- Digital goods / Stars: https://core.telegram.org/bots/payments-stars

---

# Перед публічним запуском

Обов'язково замініть текст сторінки `app/paysupport/page.js` на свій реальний контакт підтримки. За бажанням також розширте `app/terms/page.js` під вашу юридичну модель та юрисдикцію.
