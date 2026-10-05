import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCourseAccessState } from '@/lib/access';
import { loadCourseState } from '@/lib/course-state';
import { courseRequestOptions } from '@/lib/platform';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const { slug } = await params;
    const opts = courseRequestOptions(request);
    const supabase = getSupabaseAdmin();

    const { data: attempt, error: attemptError } = await supabase
      .from('course_attempts')
      .select('id,current_step,completed_steps,status')
      .eq('telegram_id', user.id)
      .eq('course_slug', slug)
      .eq('status', 'active')
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');

    const { data: course, error: courseError } = await supabase.from('courses').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
    if (courseError) throw courseError;
    if (!course) throw new Error('COURSE_NOT_FOUND');
    const { data: link } = await supabase.from('space_courses').select('*').eq('space_slug', opts.spaceSlug).eq('course_slug', slug).maybeSingle();
    const accessState = await getCourseAccessState(user.id, course, link);
    if (!accessState.access) throw new Error(accessState.trial?.used ? 'TRIAL_EXPIRED' : 'COURSE_ACCESS_REQUIRED');
    if (accessState.mode === 'trial' && accessState.trial?.max_steps && attempt.current_step > Number(accessState.trial.max_steps)) {
      throw new Error('TRIAL_STEP_LIMIT_REACHED');
    }

    const { data: blocks, error: blocksError } = await supabase
      .from('course_step_blocks')
      .select('id,block_type,config')
      .eq('course_slug', slug)
      .eq('step_number', attempt.current_step)
      .eq('is_published', true);
    if (blocksError) throw blocksError;
    const required = (blocks || []).filter(b => ['quiz','checklist'].includes(b.block_type) && b.config?.required === true);
    if (required.length) {
      const ids = required.map(b => b.id);
      const { data: done, error: doneError } = await supabase
        .from('course_step_interactions')
        .select('block_id,completed')
        .eq('attempt_id', attempt.id)
        .in('block_id', ids);
      if (doneError) throw doneError;
      const ok = new Set((done || []).filter(x => x.completed).map(x => x.block_id));
      if (required.some(b => !ok.has(b.id))) return jsonError(new Error('STEP_REQUIREMENTS_INCOMPLETE'), 409);
    }

    const { error } = await supabase.rpc('complete_current_step', { p_telegram_id: user.id, p_course_slug: slug });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('STEP_LOCKED')) return jsonError(new Error('STEP_LOCKED'), 409);
      throw error;
    }
    const state = await loadCourseState(user.id, slug, opts);
    return Response.json({ ok: true, ...state });
  } catch (error) {
    return jsonError(error, 400);
  }
}
