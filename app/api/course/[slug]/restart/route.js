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
    const { error } = await supabase.rpc('restart_course', {
      p_telegram_id: user.id,
      p_course_slug: slug
    });
    if (error) throw error;
    const state = await loadCourseState(user.id, slug);
    return Response.json({ ok: true, ...state });
  } catch (error) {
    return jsonError(error, 400);
  }
}
