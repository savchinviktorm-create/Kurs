export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function getPublicAppUrl() {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : '';
}

export const TELEGRAM_BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || 'Kurs91bot').replace(/^@/, '');
export const TELEGRAM_MINIAPP_SHORT_NAME = process.env.TELEGRAM_MINIAPP_SHORT_NAME || 'tzmin';
export const ALL_ACCESS_SUBSCRIPTION_STARS = Number(process.env.ALL_ACCESS_SUBSCRIPTION_STARS || 49);
export const DEFAULT_COURSE_PRICE_STARS = Number(process.env.DEFAULT_COURSE_PRICE_STARS || 99);
export const MEDIA_TOKEN_TTL_SECONDS = Number(process.env.MEDIA_TOKEN_TTL_SECONDS || 300);
export const COURSE_IMPORT_MAX_BYTES = Number(process.env.COURSE_IMPORT_MAX_BYTES || 4000000);
