import crypto from 'crypto';
import { requireEnv } from './env';

function safeEqualHex(a, b) {
  try {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function validateTelegramInitDataContext(initData, { maxAgeSeconds = 24 * 60 * 60 } = {}) {
  if (!initData) throw new Error('TELEGRAM_INIT_DATA_MISSING');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('TELEGRAM_HASH_MISSING');

  const entries = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    entries.push([key, value]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(requireEnv('TELEGRAM_BOT_TOKEN'))
    .digest();

  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (!safeEqualHex(expectedHash, hash)) throw new Error('TELEGRAM_HASH_INVALID');

  const authDate = Number(params.get('auth_date') || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || Math.abs(now - authDate) > maxAgeSeconds) {
    throw new Error('TELEGRAM_INIT_DATA_EXPIRED');
  }

  const rawUser = params.get('user');
  if (!rawUser) throw new Error('TELEGRAM_USER_MISSING');

  let user;
  try {
    user = JSON.parse(rawUser);
  } catch {
    throw new Error('TELEGRAM_USER_INVALID');
  }
  if (!user?.id || !user?.first_name) throw new Error('TELEGRAM_USER_INVALID');

  return {
    user,
    start_param: params.get('start_param') || null,
    query_id: params.get('query_id') || null,
    auth_date: authDate,
    chat_type: params.get('chat_type') || null,
    chat_instance: params.get('chat_instance') || null
  };
}

export function validateTelegramInitData(initData, options = {}) {
  return validateTelegramInitDataContext(initData, options).user;
}

export async function getAuthenticatedTelegramContext(request) {
  const initData = request.headers.get('x-telegram-init-data') || '';

  if (!initData && process.env.ENABLE_DEMO_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    return {
      user: {
        id: Number(process.env.DEMO_TELEGRAM_ID || 999001),
        first_name: process.env.DEMO_FIRST_NAME || 'Demo',
        username: 'demo_user',
        language_code: process.env.DEMO_LANGUAGE_CODE || 'uk'
      },
      start_param: process.env.DEMO_START_PARAM || null,
      query_id: null
    };
  }
  return validateTelegramInitDataContext(initData);
}

export async function getAuthenticatedTelegramUser(request) {
  return (await getAuthenticatedTelegramContext(request)).user;
}

export async function upsertTelegramUser(user) {
  const { getSupabaseAdmin } = await import('./supabase');
  const supabase = getSupabaseAdmin();
  const row = {
    telegram_id: user.id,
    first_name: user.first_name,
    last_name: user.last_name || null,
    username: user.username || null,
    language_code: user.language_code || null,
    photo_url: user.photo_url || null,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('users').upsert(row, { onConflict: 'telegram_id' });
  if (error) throw error;
  return row;
}

export function jsonError(error, status = 400) {
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ ok: false, error: message }, { status });
}
