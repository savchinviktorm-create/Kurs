import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
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

    const { data: attempt, error: attemptError } = await supabase.from('course_attempts').select('id,current_step,status').eq('telegram_id', user.id).eq('course_slug', slug).eq('status', 'active').maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');

    const { data: blocks, error: blocksError } = await supabase.from('course_step_blocks').select('id,block_type,config').eq('course_slug', slug).eq('step_number', attempt.current_step).eq('is_published', true);
    if (blocksError) throw blocksError;
    const required = (blocks || []).filter(b => ['quiz','checklist'].includes(b.block_type) && b.config?.required === true);
    if (required.length) {
      const ids = required.map(b => b.id);
      const { data: done, error: doneError } = await supabase.from('course_step_interactions').select('block_id,completed').eq('attempt_id', attempt.id).in('block_id', ids);
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
