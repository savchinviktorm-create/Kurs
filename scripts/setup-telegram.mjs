const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
const appUrl = rawAppUrl.replace(/\/$/, '');
const botUsername = (process.env.TELEGRAM_BOT_USERNAME || 'Kurs91bot').replace(/^@/,'');
const shortName = process.env.TELEGRAM_MINIAPP_SHORT_NAME || 'tzmin';
if (!token || !secret || !appUrl) throw new Error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and NEXT_PUBLIC_APP_URL');

async function api(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) });
  const j = await r.json(); if (!j.ok) throw new Error(`${method}: ${j.description}`); return j.result;
}

await api('setWebhook', { url: `${appUrl}/api/telegram/webhook`, secret_token: secret, allowed_updates: ['message','pre_checkout_query'] });
await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Курси', web_app: { url: appUrl } } });
await api('setMyCommands', { commands: [
  { command: 'start', description: 'Відкрити платформу курсів' },
  { command: 'terms', description: 'Умови використання' },
  { command: 'paysupport', description: 'Підтримка щодо платежів' }
]});
console.log('Telegram webhook, menu button and commands configured.');
console.log(`Mini App direct link: https://t.me/${botUsername}/${shortName}`);
console.log('Short Name is managed in BotFather; this script does not recreate it.');
