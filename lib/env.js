export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function getPublicAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
}

export const ALL_ACCESS_SUBSCRIPTION_STARS = Number(process.env.ALL_ACCESS_SUBSCRIPTION_STARS || 49);
export const DEFAULT_COURSE_PRICE_STARS = Number(process.env.DEFAULT_COURSE_PRICE_STARS || 99);
