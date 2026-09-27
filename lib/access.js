import { getSupabaseAdmin } from './supabase';

export function effectiveCourseConfig(course, spaceCourse = null) {
  const free = spaceCourse?.access_override === 'free'
    ? true
    : spaceCourse?.access_override === 'paid'
      ? false
      : Boolean(course.is_free);
  const price = Number(spaceCourse?.price_override_stars || course.one_time_price_stars || 0) || null;
  const included = spaceCourse?.included_in_subscription_override == null
    ? course.included_in_subscription !== false
    : Boolean(spaceCourse.included_in_subscription_override);
  return { is_free: free, one_time_price_stars: price, included_in_subscription: included };
}

export async function hasCourseAccess(telegramId, course, spaceCourse = null) {
  const cfg = effectiveCourseConfig(course, spaceCourse);
  if (cfg.is_free) return true;

  const supabase = getSupabaseAdmin();
  const [{ data: entitlement, error: entError }, { data: subscription, error: subError }] = await Promise.all([
    supabase.from('entitlements').select('id').eq('telegram_id', telegramId).eq('course_slug', course.slug).maybeSingle(),
    supabase.from('subscriptions').select('expires_at,plan_key').eq('telegram_id', telegramId).maybeSingle()
  ]);
  if (entError) throw entError;
  if (subError) throw subError;

  if (entitlement) return true;
  if (!cfg.included_in_subscription) return false;
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
