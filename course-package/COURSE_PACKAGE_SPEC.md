# Course Package v2

Course Package — це один ZIP, який власник завантажує через **Адмінка → Імпорт**. Після імпорту курс завжди залишається **чернеткою** (`is_published=false`) і не з'являється користувачам, доки адміністратор його не перевірить та не опублікує.

## Обов'язковий файл

У корені ZIP має бути `manifest.json` у UTF-8.

```json
{
  "format": "course-package-v2",
  "version": "2.2-2026-10-04",
  "mode": "update",
  "course": {
    "slug": "focus-30",
    "title": "Фокус",
    "short_title": "Фокус",
    "description": "Короткий опис",
    "intro_text": "Вступ",
    "logo_file": "brand/logo.png",
    "cover_file": "brand/cover.png",
    "default_locale": "uk",
    "available_locales": ["uk"],
    "is_free": false,
    "one_time_price_stars": 99,
    "included_in_subscription": true,
    "trial_enabled": true,
    "trial_days": 5,
    "trial_max_steps": 3,
    "certificate_enabled": true,
    "certificate_settings": {
      "verification_enabled": true,
      "subtitle": "Сертифікат про завершення курсу",
      "signatory_name": "",
      "signatory_title": ""
    },
    "first_step_immediate": true,
    "max_steps_per_day": 30,
    "protection_level": "maximum",
    "settings": {
      "pacing": "self_paced",
      "step_label": {"uk":"ЗАНЯТТЯ"},
      "show_week": false,
      "return_after_days": 5,
      "finish_title": "Курс завершено",
      "finish_text": "..."
    },
    "locales": {
      "uk": {"title":"Фокус","short_title":"Фокус","intro_text":"..."}
    }
  },
  "spaces": [{"slug":"pkk","is_visible":false}],
  "media": [],
  "steps": []
}
```

## Бренд-файли

У v2 можна покласти логотип та обкладинку прямо у ZIP:

```json
"logo_file": "brand/logo.png",
"cover_file": "brand/cover.png"
```

Під час імпорту вони автоматично завантажуються у public bucket `course-public`, а в БД записується готовий URL. Це дозволяє імпортувати курс одним файлом без ручного завантаження обкладинок.

## Медіа

Невеликі матеріали можна вкладати у ZIP:

```json
{
  "key": "workbook",
  "file": "media/workbook.pdf",
  "media_type": "pdf",
  "title": "Робочий зошит",
  "protection_level": "maximum",
  "watermark_enabled": true
}
```

Для великих відео/аудіо рекомендовано використовувати провайдери:

```json
{
  "key": "lesson1-video",
  "provider_key": "youtube",
  "media_type": "video",
  "title": "Відео уроку",
  "source_locator": "YOUTUBE_VIDEO_ID",
  "protection_level": "enhanced",
  "watermark_enabled": true
}
```

Підтримуються Supabase Storage, YouTube, Vimeo, Cloudflare Stream, Bunny Stream, S3-compatible, HLS, DASH, iframe/direct відповідно до налаштованих Media Providers.

## Блоки заняття

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
- `quiz`
- `divider`

### Checklist

```json
{
  "type":"checklist",
  "title":"Критерії готовності",
  "config": {
    "items":["Пункт 1","Пункт 2"],
    "required":true
  }
}
```

Якщо `required=true`, користувач не зможе завершити заняття, доки не відмітить усі пункти. Стан зберігається на сервері в межах поточної спроби проходження.

### Quiz

```json
{
  "type":"quiz",
  "title":"Перевірте себе",
  "config": {
    "required":true,
    "answer_policy":"after_attempt",
    "questions":[
      {
        "id":"q1",
        "question":"Питання?",
        "options":["A","B","C"],
        "correct_index":1,
        "explanation":"Пояснення після спроби."
      }
    ]
  }
}
```

Відповіді зберігаються на сервері. Пояснення та правильні варіанти показуються після натискання **«Перевірити відповіді»**. Якщо quiz обов'язковий, для завершення заняття достатньо виконати спробу; правильність не використовується як жорсткий бар'єр, якщо автор окремо не створить іншу логіку.

## Self-paced

Для курсу, який можна пройти у власному темпі:

```json
"max_steps_per_day": 30,
"settings": {
  "pacing":"self_paced",
  "show_week":false
}
```

`max_steps_per_day` має бути не менше максимальної кількості занять, які користувач може пройти за добу.

## Оновлення курсу

```json
"mode": "update"
```

Якщо slug уже існує, імпорт оновлює структуру чернетки, але не видаляє прогрес користувачів. Для великих структурних змін користуйтеся історією версій та попереднім переглядом.

## Пробний доступ (v2.2)

Для платного курсу можна активувати одноразовий ознайомчий період:

```json
"trial_enabled": true,
"trial_days": 5,
"trial_max_steps": 3
```

- `trial_days` — ціле число з кроком 1 (мінімум 1 день).
- `trial_max_steps` — необов'язковий ліміт безкоштовних кроків. `null` означає без ліміту за кроками.
- Trial одноразовий для пари Telegram ID + курс.
- Після завершення trial прогрес не скидається; користувач може купити курс і продовжити з того самого місця.
- Ціна після trial береться з `one_time_price_stars` або з price override конкретного Простору.

## Сертифікат (v2.2)

```json
"certificate_enabled": true,
"certificate_settings": {
  "verification_enabled": true,
  "subtitle": "Сертифікат про завершення курсу",
  "signatory_name": "",
  "signatory_title": ""
}
```

Після завершення останнього кроку користувач вводить ПІБ. Платформа формує персональний сертифікат A4 landscape у стилі Простору, автоматично підтягує назву курсу та дату завершення, створює унікальний номер і QR-посилання для перевірки.
