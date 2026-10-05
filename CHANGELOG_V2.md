# v2.0

- Додано Owner/Admin CMS.
- Додано Space/storefront routing для різних Telegram-каналів.
- Зафіксовано @Kurs91bot / `tzmin`.
- Додано owner/admin Telegram IDs.
- Додано UK/RU локалізації інтерфейсу, Space, курсів і кроків.
- Додано media library/provider abstraction.
- Додано embedded video/audio/PDF UI.
- Додано signed media tokens + personal watermark.
- Додано Course Package ZIP importer.
- Додано гнучкі course prices та Space price override.
- All Access price редагується через Admin.
- Платний блок приховується, якщо Space не містить платних курсів.
- Крок 1 відкривається одразу; наступні — за щоденною логікою.
- Оригінальний 91-кроковий текст не змінено.

## v2.1 — 2026-09-27

- Course Package v2: logo/cover можуть імпортуватися з ZIP.
- Додано block type `quiz` та серверне збереження результатів.
- Required quiz/checklist можуть блокувати завершення заняття до виконання.
- Додано self-paced presentation: власна назва «заняття», приховування тижнів, return/final тексти.
- ProtectedMedia тепер коректно відображає приватні image assets.
- Course cards використовують cover_path, якщо він заданий.
- Адмін-редактор підтримує quiz і основні course experience settings.

## v2.2.0 — 2026-10-04

### Certificates
- Персональний сертифікат після фактичного завершення курсу.
- Запит ПІБ + підтвердження написання.
- Автоматична назва курсу, дата завершення та бренд поточного Space.
- A4 landscape, premium cream/gold дизайн.
- PDF генерується локально в Mini App із високороздільного canvas, без передачі ПІБ сторонньому PDF-сервісу.
- Унікальний номер сертифіката.
- QR-код та публічна сторінка перевірки `/verify/[code]`.
- Необов'язковий підписант і роль.
- Перегляд, PDF, share, виправлення ПІБ.
- Розділ «Мої сертифікати».

### Trial access
- Увімкнення/вимкнення окремо для кожного платного курсу.
- Тривалість trial у днях з кроком 1.
- Необов'язковий ліміт кількості кроків.
- Одноразовий trial на Telegram ID + курс.
- Серверна перевірка строку та ліміту кроків.
- Прогрес зберігається після завершення trial.
- Paywall із реальною ціною курсу/Space override.
- Після Telegram Stars purchase trial позначається як converted.

### Admin / Import
- Нові блоки «Пробний доступ» і «Сертифікат після завершення» у редакторі курсу.
- Course Package v2 підтримує trial/certificate fields.
- Додано migration `004_certificates_and_trials.sql`.
- `FRESH_INSTALL.sql` оновлено до v2.2.
