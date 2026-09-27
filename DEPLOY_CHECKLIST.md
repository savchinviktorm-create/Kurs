# DEPLOY CHECKLIST — Platform v2

## Якщо оновлюєте ЧИННИЙ проект

- [ ] Зробив backup Supabase.
- [ ] Залив файли v2 у поточний GitHub repo.
- [ ] Supabase SQL Editor: виконав **тільки** `supabase/migrations/002_platform_admin.sql`.
- [ ] У Vercel залишив старі `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.
- [ ] Додав `TELEGRAM_BOT_USERNAME=Kurs91bot`.
- [ ] Додав `TELEGRAM_MINIAPP_SHORT_NAME=tzmin`.
- [ ] Додав новий випадковий `MEDIA_SIGNING_SECRET`.
- [ ] Redeploy Vercel.
- [ ] Відкрив `https://t.me/Kurs91bot/tzmin`.
- [ ] Перевірив адмінку з ID `653398188`.
- [ ] Перевірив адмінку з тестовими ID `7527010484`, `8557032404`.
- [ ] Перевірив, що Крок 1 доступний одразу.
- [ ] Перевірив, що платний блок прихований, коли платних курсів немає.
- [ ] Імпортував `course-package/sample-course-package.zip` як тест.

## Якщо робите НОВИЙ проект

- [ ] Створив Supabase.
- [ ] Виконав `supabase/FRESH_INSTALL.sql`.
- [ ] Додав усі env із `.env.example`.
- [ ] `npm install`.
- [ ] `npm run verify:course`.
- [ ] `npm run seed`.
- [ ] Deploy Vercel.
- [ ] `npm run setup:telegram` з production env.

## Перед реальним продажем

- [ ] Налаштував support bot у Admin → Settings.
- [ ] Перевірив `/terms` та `/paysupport`.
- [ ] Перевірив course price / Space override.
- [ ] Зробив тестову покупку Stars.
- [ ] Перевірив `successful_payment` і entitlement.
- [ ] Для приватного відео використовую private Stream/S3 provider + watermark.

## Додатково для v2.1

- [ ] На чинній v2 базі виконано `supabase/migrations/003_course_learning_experience.sql`.
- [ ] Vercel deployment після оновлення v2.1 має статус Ready.
- [ ] У `/admin` відкривається редактор quiz.
- [ ] Тестовий Course Package v2 імпортує logo/cover та залишається чернеткою.
- [ ] У Mini App image-блок відображається як зображення, PDF — у внутрішньому viewer.
- [ ] Required checklist + quiz не дозволяють завершити заняття до виконання.
