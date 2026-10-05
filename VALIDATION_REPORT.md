# Validation Report — Telegram Course Platform v2.2

Дата: 2026-10-04

## Перевірено

- JSON-файли проєкту успішно парсяться.
- 54 server-side JS/MJS файли (`lib`, `app/api`, `scripts`) пройшли `node --check`.
- Нові API routes для trial та certificates пройшли синтаксичну перевірку Node.
- `content/technology-changes-original.txt` не змінений відносно v2.1.
- `content/technology-changes.json` не змінений відносно v2.1.
- SHA-256 оригінального тексту курсу: `824a5f466b19aa47452a9537a060d78c1ec419189bf0efd0c3b284bac3112867`.
- Міграція `004_certificates_and_trials.sql` є адитивною: не видаляє існуючі таблиці/курси/спроби/платежі.
- `FRESH_INSTALL.sql` містить схему v2.2.
- Course Package importer приймає `trial_*` і `certificate_*` поля.
- Поточні курси після міграції мають trial/certificate вимкненими за замовчуванням.

## Реалізовані сценарії v2.2

### Trial
- одноразовість за Telegram ID + course slug;
- тривалість у днях;
- необов'язковий ліміт кроків;
- збереження прогресу після завершення trial;
- paywall із реальною ціною курсу/Space override;
- перехід trial → converted після успішної разової оплати курсу.

### Certificate
- видача тільки після `course_attempts.status = finished`;
- введення та підтвердження ПІБ;
- snapshot назви курсу та бренду Space;
- дата фактичного завершення;
- унікальний номер + verification code;
- QR verification page;
- preview + PDF + share;
- повторне відкриття через «Мої сертифікати».

## Обмеження локальної перевірки

Повний `next build` у робочому середовищі не був завершений, тому що `npm install` перевищив доступний мережевий timeout. Це не помилка коду, але фінальний production build обов'язково слід підтвердити у Vercel після завантаження архіву. Vercel має встановити нову залежність `qrcode` з `package.json`.
