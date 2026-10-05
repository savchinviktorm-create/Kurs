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

export async function getCourseAccessState(telegramId, course, spaceCourse = null) {
  const cfg = effectiveCourseConfig(course, spaceCourse);
  const base = {
    access: false,
    mode: 'locked',
    ...cfg,
    trial: {
      enabled: Boolean(course.trial_enabled && !cfg.is_free),
      eligible: false,
      active: false,
      used: false,
      days: Number(course.trial_days || 3),
      max_steps: course.trial_max_steps == null ? null : Number(course.trial_max_steps),
      started_at: null,
      ends_at: null,
      status: null,
      remaining_seconds: 0
    }
  };

  if (cfg.is_free) return { ...base, access: true, mode: 'free' };

  const supabase = getSupabaseAdmin();
  const [{ data: entitlement, error: entError }, { data: subscription, error: subError }] = await Promise.all([
    supabase.from('entitlements').select('id').eq('telegram_id', telegramId).eq('course_slug', course.slug).maybeSingle(),
    supabase.from('subscriptions').select('expires_at,plan_key').eq('telegram_id', telegramId).maybeSingle()
  ]);
  if (entError) throw entError;
  if (subError) throw subError;

  if (entitlement) return { ...base, access: true, mode: 'permanent' };
  if (cfg.included_in_subscription && subscription?.expires_at && new Date(subscription.expires_at).getTime() > Date.now()) {
    return { ...base, access: true, mode: 'subscription' };
  }

  if (!base.trial.enabled) return base;

  const { data: trial, error: trialError } = await supabase
    .from('course_trials')
    .select('id,status,started_at,ends_at,max_steps,converted_at')
    .eq('telegram_id', telegramId)
    .eq('course_slug', course.slug)
    .maybeSingle();
  if (trialError) throw trialError;

  if (!trial) {
    const { data: priorAttempt, error: priorAttemptError } = await supabase
      .from('course_attempts')
      .select('id')
      .eq('telegram_id', telegramId)
      .eq('course_slug', course.slug)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorAttemptError) throw priorAttemptError;
    return { ...base, trial: { ...base.trial, eligible: !priorAttempt } };
  }

  const now = Date.now();
  const endMs = new Date(trial.ends_at).getTime();
  const isTimeActive = trial.status === 'active' && Number.isFinite(endMs) && endMs > now;
  if (!isTimeActive && trial.status === 'active') {
    await supabase.from('course_trials').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', trial.id);
  }

  const normalizedTrial = {
    ...base.trial,
    eligible: false,
    active: isTimeActive,
    used: true,
    started_at: trial.started_at,
    ends_at: trial.ends_at,
    max_steps: trial.max_steps == null ? base.trial.max_steps : Number(trial.max_steps),
    status: isTimeActive ? 'active' : (trial.status === 'active' ? 'expired' : trial.status),
    remaining_seconds: isTimeActive ? Math.max(0, Math.floor((endMs - now) / 1000)) : 0
  };

  if (isTimeActive) return { ...base, access: true, mode: 'trial', trial: normalizedTrial };
  return { ...base, trial: normalizedTrial };
}

export async function hasCourseAccess(telegramId, course, spaceCourse = null) {
  return (await getCourseAccessState(telegramId, course, spaceCourse)).access;
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
