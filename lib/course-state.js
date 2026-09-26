import { getSupabaseAdmin } from './supabase';
import { hasCourseAccess } from './access';

export async function loadCourseState(telegramId, slug) {
  const supabase = getSupabaseAdmin();
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (courseError) throw courseError;
  if (!course) throw new Error('COURSE_NOT_FOUND');

  const access = await hasCourseAccess(telegramId, course);
  if (!access) {
    return { course, access: false, attempt: null, step: null, restart_recommended: false };
  }

  const { data: attempt, error: attemptError } = await supabase
    .from('course_attempts')
    .select('*')
    .eq('telegram_id', telegramId)
    .eq('course_slug', slug)
    .in('status', ['active', 'finished'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (attemptError) throw attemptError;

  if (!attempt) {
    return { course, access: true, attempt: null, step: null, restart_recommended: false };
  }

  let step = null;
  if (attempt.status === 'active') {
    const { data: currentStep, error: stepError } = await supabase
      .from('course_steps')
      .select('step_number, title, content')
      .eq('course_slug', slug)
      .eq('step_number', attempt.current_step)
      .maybeSingle();
    if (stepError) throw stepError;
    step = currentStep;
  }

  const now = Date.now();
  const nextUnlock = attempt.next_unlock_at ? new Date(attempt.next_unlock_at).getTime() : null;
  const restartAfterMs = course.restart_offer_after_missed_days * 24 * 60 * 60 * 1000;
  const restartRecommended = Boolean(
    attempt.status === 'active' &&
    attempt.completed_steps > 0 &&
    nextUnlock &&
    now >= nextUnlock + restartAfterMs
  );

  return {
    course,
    access: true,
    attempt,
    step,
    restart_recommended: restartRecommended,
    step_available: Boolean(attempt.status === 'active' && nextUnlock && now >= nextUnlock),
    server_now: new Date().toISOString()
  };
}
