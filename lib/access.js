import { getSupabaseAdmin } from './supabase';

export async function hasCourseAccess(telegramId, course) {
  if (course.is_free) return true;

  const supabase = getSupabaseAdmin();
  const [{ data: entitlement, error: entError }, { data: subscription, error: subError }] = await Promise.all([
    supabase
      .from('entitlements')
      .select('id')
      .eq('telegram_id', telegramId)
      .eq('course_slug', course.slug)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('expires_at')
      .eq('telegram_id', telegramId)
      .maybeSingle()
  ]);
  if (entError) throw entError;
  if (subError) throw subError;

  if (entitlement) return true;
  return Boolean(subscription?.expires_at && new Date(subscription.expires_at).getTime() > Date.now());
}

export async function getSubscriptionState(telegramId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_key, expires_at')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (error) throw error;
  return {
    active: Boolean(data?.expires_at && new Date(data.expires_at).getTime() > Date.now()),
    expires_at: data?.expires_at || null,
    plan_key: data?.plan_key || null
  };
}
