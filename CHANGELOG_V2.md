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
