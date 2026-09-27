import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

function sanitizeAnswers(raw, count) {
  const a = Array.isArray(raw) ? raw.slice(0, count) : [];
  return Array.from({ length: count }, (_, i) => Number.isInteger(a[i]) ? Number(a[i]) : null);
}

export async function POST(request, { params }) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const { slug } = await params;
    const body = await request.json();
    if (!body?.block_id) throw new Error('BLOCK_ID_REQUIRED');
    const sb = getSupabaseAdmin();

    const { data: attempt, error: attemptError } = await sb.from('course_attempts').select('*').eq('telegram_id', user.id).eq('course_slug', slug).eq('status', 'active').maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) throw new Error('ATTEMPT_NOT_FOUND');

    const { data: block, error: blockError } = await sb.from('course_step_blocks').select('id,course_slug,step_number,block_type,body,config').eq('id', body.block_id).eq('course_slug', slug).eq('step_number', attempt.current_step).eq('is_published', true).maybeSingle();
    if (blockError) throw blockError;
    if (!block) throw new Error('BLOCK_NOT_AVAILABLE');
    if (!['quiz','checklist'].includes(block.block_type)) throw new Error('BLOCK_NOT_INTERACTIVE');

    let state = {};
    let completed = false;
    if (block.block_type === 'quiz') {
      const questions = Array.isArray(block.config?.questions) ? block.config.questions : [];
      const answers = sanitizeAnswers(body.state?.answers, questions.length);
      const attempted = questions.length > 0 && answers.every(Number.isInteger);
      const score = attempted ? questions.reduce((sum, q, i) => sum + (Number(q.correct_index) === answers[i] ? 1 : 0), 0) : 0;
      state = { answers, attempted, score, total: questions.length, checked_at: attempted ? new Date().toISOString() : null };
      completed = attempted;
    } else {
      const items = Array.isArray(block.config?.items) ? block.config.items : String(block.body || '').split('\n').filter(Boolean);
      const input = Array.isArray(body.state?.checked) ? body.state.checked : [];
      const checked = Array.from({ length: items.length }, (_, i) => Boolean(input[i]));
      completed = items.length > 0 && checked.every(Boolean);
      state = { checked, completed_count: checked.filter(Boolean).length, total: items.length };
    }

    const row = { attempt_id: attempt.id, telegram_id: user.id, course_slug: slug, step_number: attempt.current_step, block_id: block.id, interaction_type: block.block_type, state, completed, updated_at: new Date().toISOString() };
    const { data, error } = await sb.from('course_step_interactions').upsert(row, { onConflict: 'attempt_id,block_id' }).select('*').single();
    if (error) throw error;
    return Response.json({ ok: true, interaction: data });
  } catch (error) { return jsonError(error, 400); }
}
