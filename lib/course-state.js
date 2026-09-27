import { getSupabaseAdmin } from './supabase';
import { hasCourseAccess } from './access';
import { localizeCourse, localizeStep } from './platform';

export async function loadCourseState(telegramId, slug, { spaceSlug = 'pkk', locale = 'uk' } = {}) {
  const supabase = getSupabaseAdmin();
  const { data: baseCourse, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  if (courseError) throw courseError;
  if (!baseCourse) throw new Error('COURSE_NOT_FOUND');

  const { data: space, error: spaceError } = await supabase.from('spaces').select('*').eq('slug', spaceSlug).eq('is_published', true).maybeSingle();
  if (spaceError) throw spaceError;
  if (!space) throw new Error('SPACE_NOT_FOUND');

  const { data: spaceCourse, error: linkError } = await supabase
    .from('space_courses').select('*').eq('space_slug', spaceSlug).eq('course_slug', slug).maybeSingle();
  if (linkError) throw linkError;
  if (!spaceCourse?.is_visible) {
    // Owners of an already purchased course can still open it from a saved link / future "My courses" surface.
    const { data: entitlement } = await supabase.from('entitlements').select('id').eq('telegram_id', telegramId).eq('course_slug', slug).maybeSingle();
    if (!entitlement && !baseCourse.is_free) throw new Error('COURSE_NOT_IN_SPACE');
  }

  const course = await localizeCourse(baseCourse, locale, space.default_locale || 'uk');
  const access = await hasCourseAccess(telegramId, course, spaceCourse);
  if (!access) {
    return { course, space, space_course: spaceCourse, access: false, attempt: null, step: null, blocks: [], restart_recommended: false };
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
    return { course, space, space_course: spaceCourse, access: true, attempt: null, step: null, blocks: [], restart_recommended: false };
  }

  let step = null;
  let blocks = [];
  if (attempt.status === 'active') {
    step = await localizeStep(slug, attempt.current_step, locale, space.default_locale || 'uk');
    const { data: rawBlocks, error: blockError } = await supabase
      .from('course_step_blocks')
      .select('id,block_type,sort_order,title,body,media_asset_id,config,locale,media_assets(id,media_type,title,protection_level,watermark_enabled,poster_url,provider_key,status)')
      .eq('course_slug', slug)
      .eq('step_number', attempt.current_step)
      .eq('is_published', true)
      .order('sort_order', { ascending: true });
    if (blockError) throw blockError;
    const all = rawBlocks || [];
    const exact = all.filter(b => b.locale === locale);
    const neutral = all.filter(b => !b.locale);
    blocks = exact.length ? exact : neutral;
    if (blocks.length) {
      const ids = blocks.map(b => b.id);
      const { data: interactions, error: interactionError } = await supabase
        .from('course_step_interactions')
        .select('block_id,state,completed,interaction_type,updated_at')
        .eq('attempt_id', attempt.id)
        .in('block_id', ids);
      if (interactionError) throw interactionError;
      const byBlock = new Map((interactions || []).map(x => [x.block_id, x]));
      blocks = blocks.map(b => ({ ...b, interaction: byBlock.get(b.id) || null }));
    }
  }

  const now = Date.now();
  const nextUnlock = attempt.next_unlock_at ? new Date(attempt.next_unlock_at).getTime() : null;
  const restartAfterMs = course.restart_offer_after_missed_days * 24 * 60 * 60 * 1000;
  const selfPaced = course.settings?.pacing === 'self_paced';
  const restartRecommended = Boolean(
    !selfPaced &&
    attempt.status === 'active' &&
    attempt.completed_steps > 0 &&
    nextUnlock &&
    now >= nextUnlock + restartAfterMs
  );
  const returnAfterDays = Number(course.settings?.return_after_days || 0);
  const lastActivity = attempt.last_completed_at || attempt.started_at;
  const returnNotice = Boolean(
    selfPaced &&
    attempt.status === 'active' &&
    attempt.completed_steps > 0 &&
    returnAfterDays > 0 &&
    lastActivity &&
    now >= new Date(lastActivity).getTime() + returnAfterDays * 24 * 60 * 60 * 1000
  );

  return {
    course,
    space,
    space_course: spaceCourse,
    locale,
    access: true,
    attempt,
    step,
    blocks,
    restart_recommended: restartRecommended,
    return_notice: returnNotice,
    step_available: Boolean(attempt.status === 'active' && nextUnlock && now >= nextUnlock),
    server_now: new Date().toISOString()
  };
}
