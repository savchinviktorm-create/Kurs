const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
if (!token || !secret || !appUrl) throw new Error('Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and NEXT_PUBLIC_APP_URL');

async function api(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description}`);
  return j.result;
}

await api('setWebhook', { url: `${appUrl}/api/telegram/webhook`, secret_token: secret, allowed_updates: ['message','pre_checkout_query'] });
await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Курси', web_app: { url: appUrl } } });
await api('setMyCommands', { commands: [
  { command: 'start', description: 'Відкрити простір курсів' },
  { command: 'terms', description: 'Умови використання' },
  { command: 'paysupport', description: 'Підтримка щодо платежів' }
]});
console.log('Telegram webhook, menu button and bot commands configured.');
