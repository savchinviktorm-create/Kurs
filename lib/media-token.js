import crypto from 'crypto';
import { requireEnv, MEDIA_TOKEN_TTL_SECONDS } from './env';

function secret() { return requireEnv('MEDIA_SIGNING_SECRET'); }
function sign(payload) { return crypto.createHmac('sha256', secret()).update(payload).digest('base64url'); }

export function createMediaToken({ telegramId, mediaId, spaceSlug, ttl = MEDIA_TOKEN_TTL_SECONDS }) {
  const payload = JSON.stringify({ u: telegramId, m: mediaId, s: spaceSlug || null, e: Math.floor(Date.now()/1000) + ttl });
  const body = Buffer.from(payload).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyMediaToken(token, mediaId) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) throw new Error('MEDIA_TOKEN_INVALID');
  const expected = sign(body);
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) throw new Error('MEDIA_TOKEN_INVALID');
  const data = JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
  if (data.m !== mediaId || !data.u || !data.e || data.e < Math.floor(Date.now()/1000)) throw new Error('MEDIA_TOKEN_EXPIRED');
  return data;
}
