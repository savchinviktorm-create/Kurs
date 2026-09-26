import { requireEnv } from './env';

export async function telegramBotApi(method, body = {}) {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`Telegram API ${method}: ${data.description || 'unknown error'}`);
  return data.result;
}
