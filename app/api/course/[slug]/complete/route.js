import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { loadCourseState } from '@/lib/course-state';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const user = await getAuthenticatedTelegramUser(request);
    await upsertTelegramUser(user);
    const { slug } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc('complete_current_step', {
      p_telegram_id: user.id,
      p_course_slug: slug
    });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('STEP_LOCKED')) return jsonError(new Error('STEP_LOCKED'), 409);
      throw error;
    }
    const state = await loadCourseState(user.id, slug);
    return Response.json({ ok: true, ...state });
  } catch (error) {
    return jsonError(error, 400);
  }
}
