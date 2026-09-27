# Course Package v1

Course Package — це один ZIP, який власник завантажує через **Адмінка → Імпорт**. Після імпорту курс завжди створюється/оновлюється як **чернетка**, а не публікується автоматично.

## Обов'язковий файл

У корені ZIP має бути `manifest.json` у UTF-8.

Мінімальна структура:

```json
{
  "format": "course-package-v1",
  "version": "1.0",
  "course": {
    "slug": "focus-30",
    "title": "Фокус",
    "short_title": "Фокус",
    "default_locale": "uk",
    "available_locales": ["uk", "ru"],
    "is_free": false,
    "one_time_price_stars": 99,
    "included_in_subscription": true,
    "first_step_immediate": true,
    "unlock_hour": 11,
    "restart_offer_after_missed_days": 5,
    "protection_level": "maximum",
    "locales": {
      "uk": { "title": "Фокус", "short_title": "Фокус", "intro_text": "..." },
      "ru": { "title": "Фокус", "short_title": "Фокус", "intro_text": "..." }
    }
  },
  "spaces": [
    { "slug": "pkk", "is_visible": false }
  ],
  "media": [],
  "steps": [
    {
      "step_number": 1,
      "title": "Старт",
      "content": "...",
      "locales": {
        "uk": { "title": "Старт", "content": "..." },
        "ru": { "title": "Старт", "content": "..." }
      },
      "blocks": []
    }
  ]
}
```

## Медіа

Рекомендований варіант для великих відео/аудіо — **не вкладати гігабайти в ZIP**, а передавати ID/URL уже завантаженого медіа-провайдера:

```json
"media": [
  {
    "key": "lesson1-video",
    "provider_key": "youtube",
    "media_type": "video",
    "title": "Відео уроку",
    "source_locator": "YOUTUBE_VIDEO_ID",
    "protection_level": "enhanced",
    "watermark_enabled": true
  }
]
```

Для приватного Supabase Storage можна покласти невеликий файл у ZIP:

```json
{
  "key": "worksheet",
  "file": "media/worksheet.pdf",
  "media_type": "pdf",
  "title": "Робочий зошит"
}
```

Під час імпорту він потрапить у приватний bucket `course-media`.

## Блоки кроку

Підтримуються:

- `text`
- `video`
- `audio`
- `pdf`
- `image`
- `file`
- `link`
- `quote`
- `checklist`
- `divider`

Приклад:

```json
"blocks": [
  {
    "type": "video",
    "title": "Подивіться пояснення",
    "media_key": "lesson1-video"
  },
  {
    "type": "quote",
    "body": "Коротка авторська цитата."
  }
]
```

## Оновлення готового курсу

Щоб імпорт оновив існуючий `slug`, а не зупинився з помилкою, додайте:

```json
"mode": "update"
```

Прогрес користувачів при цьому не видаляється. Для великих структурних змін рекомендовано створити нову версію/перевірити курс у чернетці перед публікацією.

## Важливе про DOCX/PPTX/XLSX

Вбудований користувацький переглядач працює з PDF. Office-файли можна зберігати як оригінали, але для inline-перегляду підготуйте PDF-копію. У проєкті залишена змінна `DOCUMENT_CONVERTER_URL` для майбутнього підключення зовнішнього конвертера; Vercel serverless не комплектується LibreOffice.
