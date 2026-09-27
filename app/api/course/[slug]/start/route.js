import { getAuthenticatedTelegramUser, upsertTelegramUser, jsonError } from '@/lib/telegram';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasCourseAccess } from '@/lib/access';
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

    const { data: course, error: courseError } = await supabase.from('courses').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
    if (courseError) throw courseError;
    if (!course) throw new Error('COURSE_NOT_FOUND');
    const { data: link } = await supabase.from('space_courses').select('*').eq('space_slug', opts.spaceSlug).eq('course_slug', slug).maybeSingle();
    if (!(await hasCourseAccess(user.id, course, link))) throw new Error('COURSE_ACCESS_REQUIRED');

    const { error } = await supabase.rpc('start_course', { p_telegram_id: user.id, p_course_slug: slug });
    if (error) throw error;
    const state = await loadCourseState(user.id, slug, opts);
    return Response.json({ ok: true, ...state });
  } catch (error) {
    return jsonError(error, 400);
  }
}
